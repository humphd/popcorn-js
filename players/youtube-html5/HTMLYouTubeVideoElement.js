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

  regexYouTube = /^.*(?:\/|v=)(.{11})/,

  seed = Date.now(),

  NOP = function(){},

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

    var parent = typeof id === "string" ? document.querySelector( id ) : parent,
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
      muted: false,
      currentTime: 0,
      duration: NaN,
      ended: false,
      paused: true,
      volume: 1,
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
        addPlayerReadyCallback( function(){ getDuration(); } );
        return;
      }

      var oldDuration = impl.duration,
          newDuration = player.getDuration();

      if( oldDuration !== newDuration ){
        impl.duration = newDuration;
        dispatchEvent( "durationchange" );
      }

      return newDuration;
    }

    function onPlayerStateChange( event ){
      switch( event.data ){

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

        case YT.PlayerState.ENDED:
          impl.ended = true;
          dispatchEvent( "ended" );
          break;

        case YT.PlayerState.PLAYING:
          onPlay();
          break;

        case YT.PlayerState.PAUSED:
          onPause();
          break;

        case YT.PlayerState.BUFFERING:
          impl.networkState = self.NETWORK_LOADING;
          dispatchEvent( "waiting" );
          break;

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
      // dispatch any events???
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
      // YouTube suggests 200x200 as minimum, video spec says 300x150.
      elem.width = parent.width|0 ? parent.width : 300;
      elem.height = parent.height|0 ? parent.height : 200;
      parent.appendChild( elem );

      // Get video ID out of youtube url
      // TODO: error check this...
      aSrc = regexYouTube.exec( aSrc )[ 1 ];

      player = new YT.Player( elem, {
        height: elem.height,
        width: elem.width,
        videoId: aSrc,
        events: {
          // TODO: wire up rest of handlers...
          'onReady': onPlayerReady,
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
      if( Math.abs( lastCurrentTime - currentTime ) > CURRENT_TIME_MONITOR_MS ){
        onSeeking();
        onSeeked();
      }

      // See if we had a pending seek via code
      if( seekTarget === impl.currentTime ){
        seekTarget = -1;
        onSeeked();
      }
      lastCurrentTime = impl.currentTime;
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

      // TODO: normalize, validate time???
      onSeeking();
      player.seekTo( aTime );
    }

    var timeUpdateInterval;
    function onTimeUpdate(){
      dispatchEvent( "timeupdate" );
    }

    function onSeeking(){
      impl.seeking = true;
      dispatchEvent( "seeking" );
    }

    function onSeeked(){
      impl.seeking = false;
      dispatchEvent( "seeked" );
    }

    function onPlay(){
      if ( !currentTimeInterval ){
        currentTimeInterval = setInterval( monitorCurrentTime,
                                           CURRENT_TIME_MONITOR_MS ) ;
        dispatchEvent( "playing" );
      }

      timeUpdateInterval = setInterval( onTimeUpdate,
                                        TIMEUPDATE_MS );
      impl.paused = false;
      dispatchEvent( "play" );
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

    self.addEventListener = function( type, listener, useCapture ){
      document.addEventListener( eventNamespace + type, listener, useCapture );
    };

    self.removeEventListener = function( type, listener, useCapture ){
      document.removeEventListener( eventNamespace + type, listener, useCapture );
    };

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
          impl.autoplay = !!aValue;
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
          impl.controls = !!aValue;
        }
      },

      loop: {
        get: function(){
          return impl.loop;
        },
        set: function( aValue ){
          // TODO: wire up looping...
          impl.loop = !!aValue;
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
          elem.width = aValue;
        }
      },

      height: {
        get: function(){
          return elem.height;
        },
        set: function( aValue ){
          elem.height = aValue;
        }
      },

      muted: {
        get: function(){
          return impl.muted;
        },
        set: function( aValue ){
          // TODO: mute video
          impl.muted = !!aValue;
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
          return impl.volume;
        },
        set: function( aValue ){
          // TODO: normalize, adjust player volume
          impl.volume = aValue;
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
    HAVE_ENOUGH_DATA: 4

  };

  window.HTMLYouTubeVideoElement = HTMLYouTubeVideoElement;

}( window, document ));
