(function( window, document, undefined ) {

  // parseUri 1.2.2
  // http://blog.stevenlevithan.com/archives/parseuri
  // (c) Steven Levithan <stevenlevithan.com>
  // MIT License

  function parseUri (str) {
    var	o   = parseUri.options,
        m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
        uri = {},
        i   = 14;

    while (i--) {
      uri[o.key[i]] = m[i] || "";
    }

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
      if ($1) {
        uri[o.q.name][$1] = $2;
      }
    });

    return uri;
  }

  parseUri.options = {
    strictMode: false,
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    q:   {
      name:   "queryKey",
      parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
      strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
      loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
  };



  var

  TIMEUPDATE_MS = 250,

  CURRENT_TIME_MONITOR_MS = 16,

  EMPTY_STRING = "",

  VIMEO_PLAYER_URL = "http://player.vimeo.com/video/",

  // Vimeo doesn't give a suggested min size, YouTube suggests 200x200
  // as minimum, video spec says 300x150.
  MIN_WIDTH = 300,
  MIN_HEIGHT = 200,

  seed = Date.now(),

  NOP = function(){},

  ABS = Math.abs;

  // Utility wrapper around postMessage interface
  function VimeoPlayer( vimeoIFrame ){
    var self = this,
      url = vimeoIFrame.src.split('?')[0],
      muted = 0;

    if( url.substr(0, 2) === '//' ){
      url = window.location.protocol + url;
    }

    function sendMessage( method, params ){
      var data = JSON.stringify({
        method: method,
        value: params
      });

      // The iframe has been destroyed, it just doesn't know it
      if ( !vimeoIFrame.contentWindow ) {
        return;
      }

      vimeoIFrame.contentWindow.postMessage( data, url );
    };

    var methods = ( "play pause paused seekTo unload getCurrentTime getDuration " +
                    "getVideoEmbedCode getVideoHeight getVideoWidth getVideoUrl " +
                    "getColor setColor setLoop getVolume setVolume addEventListener" ).split(" ");
    methods.forEach( function( method ){
      // All current methods take 0 or 1 args, always send arg0
      self[ method ] = function( arg0 ){
        sendMessage( method, arg0 );
      };
    });
  }


  function HTMLVimeoVideoElement( id ){

    // Vimeo iframe API requires postMessage
    if( !window.postMessage ){
      throw "ERROR: HTMLVimeoVideoElement requires window.postMessage";
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
      volume: 1,
      // Vimeo has no concept of muted, store volume values
      // such that muted===0 is unmuted, and muted>0 is muted.
      muted: 0,
      currentTime: 0,
      duration: NaN,
      ended: false,
      paused: true,
      width: parent.width|0   ? parent.width  : MIN_WIDTH,
      height: parent.height|0 ? parent.height : MIN_HEIGHT,
      error: null
    };

    var playerReady = false,
        playerUID = seed++,
        player;

    // Namespace all events we'll produce
    var eventNamespace = "HTMLVimeoVideoElement-" + seed++ + "::";

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
      player = new VimeoPlayer( elem );
      playerReady = true;

      player.addEventListener( 'loadProgress' );
      player.addEventListener( 'playProgress' );
      player.addEventListener( 'play' );
      player.addEventListener( 'pause' );
      player.addEventListener( 'finish' );
      player.addEventListener( 'seek' );

      // TODO: do I need this here???
      player.getDuration();

      // TODO: should I do this?  jbuck did...
      dispatchEvent( "loadstart" );

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

    function updateDuration( newDuration ){
      var oldDuration = impl.duration;

      if( oldDuration !== newDuration ){
        impl.duration = newDuration;
        dispatchEvent( "durationchange" );

        // First update of duration?
        if( isNaN( oldDuration ) ){
          impl.networkState = self.NETWORK_IDLE;
          impl.readyState = self.HAVE_METADATA;
          dispatchEvent( "loadedmetadata" );

          impl.readyState = self.HAVE_FUTURE_DATA;
          dispatchEvent( "canplay" );

          // TODO: this is not really true...
          impl.readyState = self.HAVE_ENOUGH_DATA;
          dispatchEvent( "canplaythrough" );
        }
      }
    }

    function getDuration(){
      if( !playerReady ){
        // Queue a getDuration() call so we have correct duration info for loadedmetadata
        addPlayerReadyCallback( function(){ getDuration(); } );
      }

      player.getDuration();
    }

    // TODO error states and player state changes...

    function destroyPlayer(){
      if( !( playerReady && player ) ){
        return;
      }
      clearInterval( currentTimeInterval );
      player.pause();

      // TODO: dispatch any events???
      window.removeEventListener( 'message', onStateChange, false );
      parent.removeChild( elem );
      elem = null;

      // TODO: remove any listeners that were added via self.addEventListener
    }

    function sendMessage( method, params ) {
      var url = vimeoContainer.src.split('?')[0],
        data = JSON.stringify({
          method: method,
          value: params
        });

      if( url.substr(0, 2) === '//' ){
        url = window.location.protocol + url;
      }

      // The iframe has been destroyed, it just doesn't know it
      if ( !elem.contentWindow ) {
        destroyPlayer();
        return;
      }

      elem.contentWindow.postMessage( data, url );
    }

    self.play = function(){
      if( !playerReady ){
        addPlayerReadyCallback( function(){ self.play(); } );
        return;
      }
      player.play();
    };

    function changeCurrentTime( aTime ){
      if( !playerReady ){
        addPlayerReadyCallback( function(){ changeCurrentTime( aTime ); } );
        return;
      }

      onSeeking( aTime );
      player.seekTo( aTime );
    }

    function onSeeking( target ){
      impl.seeking = true;
      dispatchEvent( "seeking" );
    }

    function onSeeked(){
      impl.seeking = false;
//      dispatchEvent( "timeupdate" );
      dispatchEvent( "seeked" );
    }

    self.pause = function(){
      if( !playerReady ){
        addPlayerReadyCallback( function(){ self.pause(); } );
        return;
      }

      player.pause();
    };

    function onPause(){
      impl.paused = true;
      clearInterval( timeUpdateInterval );
      dispatchEvent( "pause" );
    }

    var timeUpdateInterval;
    function onTimeUpdate(){
      dispatchEvent( "timeupdate" );
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

    function onEnded(){
      if( impl.loop ){
        changeCurrentTime( 0 );
        self.play();
      } else {
        impl.ended = true;
        dispatchEvent( "ended" );
      }
    }

    function onCurrentTime( aTime ){
      var currentTime = impl.currentTime = aTime;
      if( currentTime !== lastCurrentTime ){
        dispatchEvent( "timeupdate" );
      }

/**
      // See if the user seeked the video via controls
      if( !impl.seeking && ABS( lastCurrentTime - currentTime ) > CURRENT_TIME_MONITOR_MS ){
console.log('onCurrentTime looks like user seeked via controls, onSeeking, onSeeked', lastCurrentTime, currentTime);

console.log('calling onSeeking - 1');
        onSeeking();

console.log('calling onSeeked - 1');
        onSeeked();
      }
**/

/**
      // See if we had a pending seek via code.  Vimeo drops us within
      // 1 second of our target time, so we have to round a bit, or miss
      // many seek ends.
      if( ( seekTarget > -1 ) &&
          ( ABS( currentTime - seekTarget ) < 1 ) ){
console.log('onCurrentTime, seekTarget > -1', seekTarget, currentTime);
        seekTarget = -1;
        onSeeked();
      }
**/
      lastCurrentTime = impl.currentTime;

      // TODO: also monitor muted, volume, etc. for user interaction?
    }

    function onStateChange( event ){
      if( event.origin !== "http://player.vimeo.com" ){
        return;
      }

      var data;
      try {
        data = JSON.parse( event.data );
      } catch ( ex ) {
        console.warn( ex );
      }

      if ( data.player_id != playerUID ) {
//        console.log("messageListener - wrong playerUID", data.player_id, playerUID);
        return;
      }

      // Methods
      switch ( data.method ) {
        case "getCurrentTime":
          onCurrentTime( parseFloat( data.value ) );
          break;
        case "getDuration":
          updateDuration( parseFloat( data.value ) );
          break;
        case "getVolume":
          onVolume( parseFloat( data.value ) );
          break;
      }

      // Events
      switch ( data.event ) {
        case "ready":
          onPlayerReady();
          break;
        case "loadProgress":
          dispatchEvent( "progress" );
          // loadProgress has a more accurate duration than getDuration
          updateDuration( parseFloat( data.data.duration ) );
          break;
        case "playProgress":
// Do I care about this?
//          impl.currentTime = parseFloat( data.data.seconds );
          onCurrentTime( parseFloat( data.data.seconds ) );
          break;
        case "play":
//          // Vimeo plays video if seeking from an unloaded state
//          if ( impl.seeking ) {
//            impl.seeking = false;
//            media.dispatchEvent( "seeked" );
//          }
          onPlay();
//          impl.paused = false;
//          impl.ended = false;
//          startUpdateLoops();
//          media.dispatchEvent( "play" );
          break;
        case "pause":
console.log('pause callback');
          onPause();
          break;
        case "finish":
          onEnded();
          break;
        case "seek":
          onCurrentTime( parseFloat( data.data.seconds ) );
          onSeeked();
//          impl.currentTime = parseFloat( data.data.seconds );
//          impl.seeking = false;
//          impl.ended = false;
//          media.dispatchEvent( "timeupdate" );
//          media.dispatchEvent( "seeked" );
          break;
      }
    }

    var currentTimeInterval,
        lastCurrentTime = 0;
    function monitorCurrentTime(){
      player.getCurrentTime();
      // TODO: also monitor muted, volume, etc. for user interaction?
    }

    function changeSrc( aSrc ){
      impl.src = aSrc;

      if( playerReady ){
        destroyPlayer();
      }

      playerReady = false;

      var src = parseUri( aSrc ),
        queryKey = src.queryKey,
        key,
        optionsArray = [
          // Vimeo API options first
          "api=1",
          "player_id=" + playerUID
        ];

// TODO -- figure this out
//      if ( !canPlayType( media.nodeName, src.source ) ) {
//        setErrorAttr( impl.MEDIA_ERR_SRC_NOT_SUPPORTED );
//        return;
//      }

        // Add Popcorn ctor options, url options, then the Vimeo API options
//        Popcorn.extend( combinedOptions, options );
//        Popcorn.extend( combinedOptions, src.queryKey );
//        Popcorn.extend( combinedOptions, vimeoAPIOptions );

        // Create the base vimeo player string. It will always have query string options
      src = "http://player.vimeo.com/video/" + ( /\d+$/ ).exec( src.path ) + "?";
      for( key in queryKey ){
        if ( queryKey.hasOwnProperty( key ) ){
          optionsArray.push( encodeURIComponent( key ) + "=" +
                             encodeURIComponent( queryKey[ key ] ) );
        }
      }
      src += optionsArray.join( "&" );

// TODO: this will mean doing `video.autoplay=true` gets ignored...
// Should we allow these on the URL?  Or force through properties?
//      impl.loop = !!src.match( /loop=1/ );
//      impl.autoplay = !!src.match( /autoplay=1/ );

      elem = document.createElement( "iframe" );
      elem.id = playerUID;
      elem.width = impl.width; // 500?
      elem.height = impl.height; // 281?
      elem.frameBorder = 0;
      elem.webkitAllowFullScreen = true;
      elem.mozAllowFullScreen = true;
      elem.allowFullScreen = true;
      elem.src = src;
      parent.appendChild( elem );

      window.addEventListener( 'message', onStateChange, false );

      // Queue a get duration call so we'll have duration info
      // and can dispatch durationchange.
//      getDuration();
    }

    function onVolume( aValue ){
      impl.volume = aValue;
    }

    function setVolume( aValue ){
      if( !playerReady ){
        impl.volume = aValue;
        addPlayerReadyCallback( function(){
          setVolume( impl.volume );
        });
        return;
      }

      player.setVolume( aValue );
      dispatchEvent( "volumechange" );
    }

    function getVolume(){
      // If we're muted, the volume is cached on impl.muted.
      return impl.muted > 0 ? impl.muted : impl.volume;
    }

    function setMuted( aMute ){
      if( !playerReady ){
        impl.muted = aMute ? 1 : 0;
        addPlayerReadyCallback( function(){
          setMuted( aMute );
        });
        return;
      }

      // Move the existing volume onto muted to cache
      // until we unmute, and set the volume to 0.
      if( aMute ){
        impl.muted = impl.volume;
        setVolume( 0 );
      } else {
        impl.muted = 0;
        setVolume( impl.muted );
      }
    }

    function getMuted(){
      return impl.muted > 0;
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
          // TODO: might want to do something different with none vs. others.
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
          return impl.currentTime;
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
          return impl.duration; //getDuration();
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

  } // end HTMLVimeoVideoElement

  HTMLVimeoVideoElement.prototype = {

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

    canPlayType: function( url ){
      return ( (/player.vimeo.com\/video\/\d+/).test( url ) ||
               (/vimeo.com\/\d+/).test( url ) ) ? "probably" : EMPTY_STRING;
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

  window.HTMLVimeoVideoElement = HTMLVimeoVideoElement;

}( window, document ));
