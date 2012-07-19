
/**
 * Simplified Media Fragments (http://www.w3.org/TR/media-frags/) Null player.
 * Valid URIs include:
 *
 * #t=,100   -- a null video of 100s
 * #t=5,100  -- a null video of 100s, which starts at 5s (i.e., 95s duration)
 *
 */

(function( window, document, undefined ){

  var

  TIMEUPDATE_MS = 250,

  // How often (ms) to update the video's current time,
  // and by how much (s).
  DEFAULT_UPDATE_RESOLUTION_MS = 16,
  DEFAULT_UPDATE_RESOLUTION_S = DEFAULT_UPDATE_RESOLUTION_MS / 1000,

  EMPTY_STRING = "",

  MIN_WIDTH = 300,
  MIN_HEIGHT = 150,

  SEED = Date.now(),

  temporalRegex = /#t=(\d+)?,?(\d+)?/,

  NOP = function(){},
  ABS = Math.abs;

  function NullPlayer( options ){
    this.currentTime = options.currentTime || 0;
    this.duration = options.duration || NaN;
    this.playInterval = null;
    this.ended = options.endedCallback || NOP;
  }

  function nullPlay( video ){
    if( video.currentTime + DEFAULT_UPDATE_RESOLUTION_S >= video.duration ){
      video.currentTime = video.duration;
      video.pause();
      video.ended();
    } else {
      video.currentTime += DEFAULT_UPDATE_RESOLUTION_S;
    }
  }

  NullPlayer.prototype = {

    play: function(){
      var video = this;
      this.playInterval = setInterval( function(){ nullPlay( video ); },
                                       DEFAULT_UPDATE_RESOLUTION_MS );
    },

    pause: function(){
      clearInterval( this.playInterval );
    },

    seekTo: function( aTime ){
      aTime = aTime < 0 ? 0 : aTime;
      aTime = aTime > this.duration ? this.duration : aTime;
      this.currentTime = aTime;
    }

  };


  function HTMLNullVideoElement( id ){

    var self = this;

    var parent = typeof id === "string" ? document.querySelector( id ) : id,
      elem,
      playerReady = false,
      player;

    var impl = {
      src: EMPTY_STRING,
      networkState: self.NETWORK_EMPTY,
      readyState: self.HAVE_NOTHING,
      autoplay: EMPTY_STRING,
      preload: EMPTY_STRING,
      controls: EMPTY_STRING,
      loop: false,
      poster: EMPTY_STRING,
      volume: 1,
      muted: false,
      width: parent.width|0   ? parent.width  : MIN_WIDTH,
      height: parent.height|0 ? parent.height : MIN_HEIGHT,
      seeking: false,
      ended: false,
      paused: 1, // 1 vs. true to differentiate first time access
      error: null
    };

    // Namespace all events we'll produce
    var eventNamespace = "HTMLNullVideoElement-" + SEED++ + "::";

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

    function onPlayerReady( ){
      playerReady = true;

      impl.networkState = self.NETWORK_IDLE;
      impl.readyState = self.HAVE_METADATA;
      dispatchEvent( "loadedmetadata" );

      impl.readyState = self.HAVE_FUTURE_DATA;
      dispatchEvent( "canplay" );

      impl.readyState = self.HAVE_ENOUGH_DATA;
      dispatchEvent( "canplaythrough" );

      var i = playerReadyCallbacks.length;
      while( i-- ){
        playerReadyCallbacks[ i ]();
        delete playerReadyCallbacks[ i ];
      }

      // Auto-start if necessary
      if( impl.autoplay ){
        self.play();
      }
    }

    function getDuration(){
      return player ? player.duration : NaN;
    }

// TODO: other errors I care about?

    function destroyPlayer(){
      if( !( playerReady && player ) ){
        return;
      }
      player.pause();
      player = null;
      parent.removeChild( elem );
      elem = null;

      // TODO: remove any listeners that were added via self.addEventListener
    }

    function changeSrc( aSrc ){
      if( !self.canPlayType( aSrc ) ){
        impl.error = {
          name: "MediaError",
          message: "Media Source Not Supported",
          code: self.MEDIA_ERR_SRC_NOT_SUPPORTED
        };
        dispatchEvent( "error" );
        return;
      }

      impl.src = aSrc;

      if( playerReady ){
        destroyPlayer();
      }

      elem = document.createElement( "div" );
      elem.width = impl.width;
      elem.height = impl.height;
      parent.appendChild( elem );

      // Parse out the start and duration, if specified
      var fragments = temporalRegex.exec( aSrc ),
          start = fragments[ 1 ],
          duration = fragments [ 2 ];

      player = new NullPlayer({
        currentTime: start,
        duration: duration,
        endedCallback: onEnded
      });

      dispatchEvent( "durationchange" );
      onPlayerReady();
    }

    function getCurrentTime(){
      if( !playerReady ){
        return 0;
      }

      return player.currentTime;
    }

    function changeCurrentTime( aTime ){
      if( !playerReady ){
        addPlayerReadyCallback( function(){ changeCurrentTime( aTime ); } );
        return;
      }

      onSeeking();
      player.seekTo( aTime );
      onSeeked();
    }

    var timeUpdateInterval;
    function onTimeUpdate(){
      dispatchEvent( "timeupdate" );
    }

    function onSeeking( target ){
      impl.seeking = true;
      dispatchEvent( "seeking" );
    }

    function onSeeked(){
      impl.seeking = false;
      dispatchEvent( "timeupdate" );
      dispatchEvent( "seeked" );
    }

    function onPlay(){
      // Deal with first time play vs. subsequent.
      if( impl.paused === 1 ){
        impl.paused = false;
        dispatchEvent( "play" );
        dispatchEvent( "playing" );
      } else {
        if( impl.ended ){
          changeCurrentTime( 0 );
        }

        if ( impl.paused ){
          impl.paused = false;
          if ( !impl.loop ){
            dispatchEvent( "play" );
          }

          dispatchEvent( "playing" );
        }
      }

      timeUpdateInterval = setInterval( onTimeUpdate,
                                        TIMEUPDATE_MS );
    }

    self.play = function(){
      if( !playerReady ){
        addPlayerReadyCallback( function(){ self.play(); } );
        return;
      }
      player.play();
      onPlay();
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
      player.pause();
      onPause();
    };

    function onEnded(){
      if( impl.loop ){
        changeCurrentTime( 0 );
        self.play();
      } else {
        impl.ended = true;
        clearInterval( timeUpdateInterval );
        dispatchEvent( "timeupdate" );
        dispatchEvent( "ended" );
      }
    }

    function setVolume( aValue ){
      impl.volume = aValue;
      dispatchEvent( "volumechange" );
    }

    function getVolume(){
      return impl.volume;
    }

    function setMuted( aValue ){
      impl.muted = aValue;
      dispatchEvent( "volumechange" );
    }

    function getMuted(){
      return impl.muted;
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
          return getVolume();
        },
        set: function( aValue ){
          if( aValue < 0 || aValue > 1 ){
            throw "Volume value must be between 0.0 and 1.0";
          }

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

  HTMLNullVideoElement.prototype = {

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
      return ( /#t=\d*,?\d+?/ ).test( url ) ?
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

  window.HTMLNullVideoElement = HTMLNullVideoElement;

}( window, document ));
