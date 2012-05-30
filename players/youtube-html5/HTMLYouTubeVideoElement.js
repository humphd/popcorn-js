/**
 *  HTMLYouTubeVideoElement - HTML5 Video API wrapper around YouTube iFrame API
 *  see: https://developers.google.com/youtube/iframe_api_reference
 *
 *  Usage:
 *
 *  <div id="video"></div>
 *  ...
 *  <script>
 *  // Pass element or selector (e.g., ID) for element to use as parent
 *  var video = new HTMLYouTubeVideoElement( "#video" );
 *
 *  video.addEventListener( "metadataloaded", function(){
 *    console.log("metadataloaded");
 *     video.play();
 *  }, false);
 *
 *  video.addEventListener( "durationchange", function(){
 *    console.log("durationchange", video.duration);
 *  }, false);
 *
 *  video.addEventListener( "seeking", function(){
 *    console.log("seeking");
 *  }, false);
 *
 *  video.addEventListener( "seeked", function(){
 *    console.log("seeked");
 *  }, false);
 *
 *  video.addEventListener( "timeupdate", function(){
 *    console.log("timeupdate", video.currentTime);
 *  }, false);
 *
 *  video.addEventListener( "pause", function(){
 *    console.log("pause");
 *  }, false);
 *
 *  video.addEventListener( "play", function(){
 *    console.log("play");
 *  }, false);
 *
 *  video.src = "http://www.youtube.com/watch?v=nfGV32RNkhw";
 *
 *  </script>
 */

(function( window, document, undefined ){

  var

  TIMEUPDATE_MS = 250,

  CURRENT_TIME_MONITOR_MS = 10,

  EMPTY_STRING = "",

  // YouTube suggests 200x200 as minimum, video spec says 300x150.
  MIN_WIDTH = 300,
  MIN_HEIGHT = 200,

  regexYouTube = /^.*(?:\/|v=)(.{11})/,

  seed = Date.now(),

  NOP = function(){},

  ABS = Math.abs,

  // Setup for YouTube API
  ytReady = false,
  ytLoaded = false,
  ytCallbacks = [];

  function isYouTubeReady(){
    // If the YouTube iframe API isn't injected, to it now.
    if( !ytLoaded ){
      var tag = document.createElement( "script" );
      tag.src = "http://www.youtube.com/player_api";
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      ytLoaded = true;
    }
    return ytReady;
  }

  function addYouTubeCallback( callback ){
    ytCallbacks.unshift( callback );
  }

  window.onYouTubePlayerAPIReady = function(){
    ytReady = true;
    var i = ytCallbacks.length;
    while( i-- ){
      ytCallbacks[ i ]();
      delete ytCallbacks[ i ];
    }
  };


  function HTMLYouTubeVideoElement( id ){

    // YouTube iframe API requires postMessage
    if( !window.postMessage ){
      throw "ERROR: HTMLYouTubeVideoElement requires window.postMessage";
    }

    var self = this;

    var parent = typeof id === "string" ? document.querySelector( id ) : id,
      elem;

    var impl = {
      src: EMPTY_STRING,
      networkState: self.NETWORK_EMPTY,
      readyState: self.HAVE_NOTHING,
      seeking: false,
      autoPlay: EMPTY_STRING,
      preload: EMPTY_STRING,
      controls: true,
      loop: false,
      poster: EMPTY_STRING,
      volume: -1,
      muted: false,
      currentTime: 0,
      duration: NaN,
      ended: false,
      paused: true,
      width: parent.width|0   ? parent.width  : MIN_WIDTH,
      height: parent.height|0 ? parent.height : MIN_HEIGHT,
      error: null
    };

    var playerReady = false,
        player;

    // Namespace all events we'll produce
    var eventNamespace = "HTMLYouTubeVideoElement-" + seed++ + "::";

    function dispatchEvent( name ){
      var customEvent = document.createEvent( "CustomEvent" ),
        detail = {
          type: name,
          target: parent,
          data: null
        };

      customEvent.initCustomEvent( eventNamespace + name, false, false, detail );
      document.dispatchEvent( customEvent );
    }

    var playerReadyCallbacks = [];
    function addPlayerReadyCallback( callback ){
      playerReadyCallbacks.unshift( callback );
    }

    function onPlayerReady( event ){
      playerReady = true;

      // Auto-start if necessary
      if( impl.autoplay ){
        self.play();
      }

      var i = playerReadyCallbacks.length;
      while( i-- ){
        playerReadyCallbacks[ i ]();
        delete playerReadyCallbacks[ i ];
      }
    }

    function getDuration(){
      if( !playerReady ){
        // Queue a getDuration() call so we have correct duration info for loadedmetadata
        addPlayerReadyCallback( function(){ getDuration(); } );
        return impl.duration;
      }

      var oldDuration = impl.duration,
          newDuration = player.getDuration();
      if( oldDuration !== newDuration ){
        impl.duration = newDuration;
        dispatchEvent( "durationchange" );
      }

      return newDuration;
    }

    function onPlayerError(event) {
      // There's no perfect mapping to HTML5 errors from YouTube errors.
      var err = { name: "MediaError" };

      switch( event.data ){

        // invalid parameter
        case 2:
          err.message = "Invalid video parameter.";
          err.code = self.MEDIA_ERR_ABORTED;
          break;

        // requested video not found
        case 100:
          err.message = "Video not found.";
          err.code = self.MEDIA_ERR_NETWORK;
          break;

        // video can't be embedded by request of owner
        case 101:
        case 150:
          err.message = "Video not usable.";
          err.code = self.MEDIA_ERR_SRC_NOT_SUPPORTED;
          break;
      }

      impl.error = err;
      dispatchEvent( "error" );
    }

    function onPlayerStateChange( event ){
      switch( event.data ){

        // unstarted
        case -1:
          impl.networkState = self.NETWORK_IDLE;
          impl.readyState = self.HAVE_METADATA;
          dispatchEvent( "loadedmetadata" );

          // XXX: this should really live in cued below, but doesn't work.
          impl.readyState = self.HAVE_FUTURE_DATA;
          dispatchEvent( "canplay" );

          impl.readyState = self.HAVE_ENOUGH_DATA;
          dispatchEvent( "canplaythrough" );
          break;

        // ended
        case YT.PlayerState.ENDED:
          onEnded();
          break;

        // playing
        case YT.PlayerState.PLAYING:
          onPlay();
          break;

        // paused
        case YT.PlayerState.PAUSED:
          onPause();
          break;

        // buffering
        case YT.PlayerState.BUFFERING:
          impl.networkState = self.NETWORK_LOADING;
          dispatchEvent( "waiting" );
          break;

        // video cued
        case YT.PlayerState.CUED:

          // XXX: cued doesn't seem to fire reliably, bug in youtube api?
          // impl.readyState = self.HAVE_FUTURE_DATA;
          // dispatchEvent( "canplay" );
          //
          // impl.readyState = self.HAVE_ENOUGH_DATA;
          // dispatchEvent( "canplaythrough" );

          break;
      }
    }

    function destroyPlayer(){
      if( !( playerReady && player ) ){
        return;
      }
      clearInterval( currentTimeInterval );
      player.stopVideo();
      player.clearVideo();

      // TODO: dispatch any events???

      parent.removeChild( elem );
      elem = null;

      // TODO: remove any listeners that were added via self.addEventListener
    }

    function changeSrc( aSrc ){
      impl.src = aSrc;

      // Make sure YouTube is ready, and if not, register a callback
      if( !isYouTubeReady() ){
        addYouTubeCallback( function() { changeSrc( aSrc ); } );
        return;
      }

      if( playerReady ){
        destroyPlayer();
      }

      elem = document.createElement("div");
      elem.width = impl.width;
      elem.height = impl.height;
      parent.appendChild( elem );

      // Get video ID out of youtube url
      // TODO: error check this...
      aSrc = regexYouTube.exec( aSrc )[ 1 ];

      player = new YT.Player( elem, {
        width: impl.width,
        height: impl.height,
        videoId: aSrc,
        events: {
          // TODO: wire up rest of handlers...
          'onReady': onPlayerReady,
          'onError': onPlayerError,
          'onStateChange': onPlayerStateChange
        }
      });

      // Queue a get duration call so we'll have duration info
      // and can dispatch durationchange.
      getDuration();
    }

    var currentTimeInterval,
        lastCurrentTime = 0,
        seekTarget = -1;
    function monitorCurrentTime(){
      var currentTime = impl.currentTime = player.getCurrentTime();

      // See if the user seeked the video via controls
      if( ABS( lastCurrentTime - currentTime ) > CURRENT_TIME_MONITOR_MS ){
        onSeeking();
        onSeeked();
      }

      // See if we had a pending seek via code.  YouTube drops us within
      // 1 second of our target time, so we have to round a bit, or miss
      // many seek ends.
      if( ( seekTarget > -1 ) &&
          ( ABS( currentTime - seekTarget ) < 1 ) ){
        seekTarget = -1;
        onSeeked();
      }
      lastCurrentTime = impl.currentTime;

      // TODO: also monitor muted, volume, etc. for user interaction?
    }

    function getCurrentTime(){
      if( !playerReady ){
        return 0;
      }

      impl.currentTime = player.getCurrentTime();
      return impl.currentTime;
    }

    function changeCurrentTime( aTime ){
      if( !playerReady ){
        addPlayerReadyCallback( function(){ changeCurrentTime( aTime ); } );
        return;
      }

      onSeeking( aTime );
      player.seekTo( aTime );
    }

    var timeUpdateInterval;
    function onTimeUpdate(){
      dispatchEvent( "timeupdate" );
    }

    function onSeeking( target ){
      if( target !== undefined ){
        seekTarget = target;
      }
      impl.seeking = true;
      dispatchEvent( "seeking" );
    }

    function onSeeked(){
      impl.seeking = false;
      dispatchEvent( "timeupdate" );
      dispatchEvent( "seeked" );
    }

    function onPlay(){
      if( impl.ended ){
        changeCurrentTime( 0 );
      }

      if ( !currentTimeInterval ){
        currentTimeInterval = setInterval( monitorCurrentTime,
                                           CURRENT_TIME_MONITOR_MS ) ;
        dispatchEvent( "playing" );

        // TODO: this is hacky, want only 1 play when video.loop=true
        if ( impl.loop ){
          dispatchEvent( "play" );
        }
      }

      timeUpdateInterval = setInterval( onTimeUpdate,
                                        TIMEUPDATE_MS );

      if( impl.paused ){
        impl.paused = false;

        // TODO: this is hacky, want only 1 play when video.loop=true
        if ( !impl.loop ){
          dispatchEvent( "play" );
        }
      }
    }

    self.play = function(){
      if( !playerReady ){
        addPlayerReadyCallback( function(){ self.play(); } );
        return;
      }
      player.playVideo();
    };

    function onPause(){
      impl.paused = true;
      clearInterval( timeUpdateInterval );
      dispatchEvent( "pause" );
    }

    self.pause = function(){
      if( !playerReady ){
        addPlayerReadyCallback( function(){ self.pause(); } );
        return;
      }
      player.pauseVideo();
    };

    function onEnded(){
      if( impl.loop ){
        changeCurrentTime( 0 );
        self.play();
      } else {
        impl.ended = true;
        dispatchEvent( "ended" );
      }
    }

    function setVolume( aValue ){
      if( !playerReady ){
        impl.volume = aValue;
        addPlayerReadyCallback( function(){
          setVolume( impl.volume );
          impl.volume = -1;
        });
        return;
      }

      player.setVolume( aValue );
      dispatchEvent( "volumechange" );
    }

    function getVolume(){
      if( !playerReady ){
        return impl.volume > -1 ? impl.volume : 1;
      }
      // TODO: better to maintain our own value internally so changes are sync?
      return player.getVolume();
    }

    function setMuted( aValue ){
      if( !playerReady ){
        impl.muted = aValue;
        addPlayerReadyCallback( function(){ setMuted( impl.muted ); } );
        return;
      }
      player[ aValue ? "mute" : "unMute" ]();
      dispatchEvent( "volumechange" );
    }

    function getMuted(){
      if( !playerReady ){
        return impl.muted;
      }
      // TODO: better to maintain our own value internally so changes are sync?
      return player.isMuted();
    }

    self.addEventListener = function( type, listener, useCapture ){
      document.addEventListener( eventNamespace + type, listener, useCapture );
    };

    self.removeEventListener = function( type, listener, useCapture ){
      document.removeEventListener( eventNamespace + type, listener, useCapture );
    };

    // Check for attribute being set or value being set in JS.  The following are true:
    // autoplay
    // autoplay="true"
    // v.autoplay=true;
    function isAttributeSet( value ){
      return ( typeof value === "string" || value === true );
    }

    // Expose various properties, similar to a <video>
    Object.defineProperties( self, {

      src: {
        get: function(){
          return impl.src;
        },
        set: function( aSrc ){
          if( aSrc && aSrc !== impl.src ){
            changeSrc( aSrc );
          }
        }
      },

      currentSrc: {
        get: function(){
          return impl.src;
        }
      },

      autoplay: {
        get: function(){
          return impl.autoplay;
        },
        set: function( aValue ){
          impl.autoplay = isAttributeSet( aValue );
        }
      },

      preload: {
        get: function(){
          return impl.preload;
        },
        set: function( aValue ){
          aValue = [ "none", "metadata", "auto", "" ].indexOf( aValue ) > -1 ? aValue : "";
          // TODO: might want to do something different with none vs. others for yt.
          impl.preload = aValue;
        }
      },

      controls: {
        get: function(){
          return impl.controls;
        },
        set: function( aValue ){
          // TODO: can we show/hide controls?
          impl.controls = isAttributeSet( aValue );
        }
      },

      loop: {
        get: function(){
          return impl.loop;
        },
        set: function( aValue ){
          impl.loop = isAttributeSet( aValue );
        }
      },

      poster: {
        get: function(){
          return impl.poster;
        },
        set: function( aValue ){
          // TODO: load image at aValue url and overlay iframe when paused.
          impl.poster = aValue;
        }
      },

      width: {
        get: function(){
          return elem.width;
        },
        set: function( aValue ){
          impl.width = aValue;
        }
      },

      height: {
        get: function(){
          return elem.height;
        },
        set: function( aValue ){
          impl.height = aValue;
        }
      },

      currentTime: {
        get: function(){
          return getCurrentTime();
        },
        set: function( aValue ){
          // TODO: do seeking, type check...
          changeCurrentTime( aValue );
        }
      },

      duration: {
        get: function(){
          // TODO: Need to make this dynamic, copy spec:
          // The length of the media in seconds, or zero if no media data is available.
          // If the media data is available but the length is unknown, this value is NaN.
          // If the media is streamed and has no predefined length, the value is Inf. Read only.
          return getDuration();
        }
      },

      ended: {
        get: function(){
          return impl.ended;
        }
      },

      paused: {
        get: function(){
          return impl.paused;
        }
      },

      seeking: {
        get: function(){
          return impl.seeking;
        }
      },

      readyState: {
        get: function(){
          return impl.readyState;
        }
      },

      networkState: {
        get: function(){
          return impl.networkState;
        }
      },

      volume: {
        get: function(){
          // Remap from HTML5's 0-1 to YouTube's 0-100 range
          var volume = getVolume();
          return volume / 100;
        },
        set: function( aValue ){
          if( aValue < 0 || aValue > 1 ){
            throw "Volume value must be between 0.0 and 1.0";
          }

          // Remap from HTML5's 0-1 to YouTube's 0-100 range
          aValue = aValue * 100;

          setVolume( aValue );
        }
      },

      muted: {
        get: function(){
          return getMuted();
        },
        set: function( aValue ){
          setMuted( isAttributeSet( aValue ) );
        }
      },

      error: {
        get: function(){
          return impl.error;
        }
      }


      // TODO:
      //
      // defaultMuted

      // defaultPlaybackRate

      // initialTime

      // playbackRate

      // startOffsetTime

    });

  }

  HTMLYouTubeVideoElement.prototype = {

    crossorigin: {
      get: function(){
        return EMPTY_STRING;
      }
    },

    played: {
      get: function(){
        // Fake a TimeRanges object
        return {
          length: 0,
          start: NOP,
          end: NOP
        };
      }
    },

    seekable: {
      get: function(){
        // Fake a TimeRanges object
        return {
          length: 0,
          start: NOP,
          end: NOP
        };
      }
    },

    buffered: {
      get: function(){
        // Fake a TimeRanges object
        return {
          length: 0,
          start: NOP,
          end: NOP
        };
      }
    },

    // TODO: implement load()
    load: NOP,

    canPlayType: function( url ) {
      return (/(?:http:\/\/www\.|http:\/\/|www\.|\.|^)(youtu)/).test( url ) ?
              "probably" :
              EMPTY_STRING;
    },

    NETWORK_EMPTY: 0,
    NETWORK_IDLE: 1,
    NETWORK_LOADING: 2,
    NETWORK_NO_SOURCE: 3,

    HAVE_NOTHING: 0,
    HAVE_METADATA: 1,
    HAVE_CURRENT_DATA: 2,
    HAVE_FUTURE_DATA: 3,
    HAVE_ENOUGH_DATA: 4,

    MEDIA_ERR_ABORTED: 1,
    MEDIA_ERR_NETWORK: 2,
    MEDIA_ERR_DECODE: 3,
    MEDIA_ERR_SRC_NOT_SUPPORTED: 4

  };

  window.HTMLYouTubeVideoElement = HTMLYouTubeVideoElement;

}( window, document ));
