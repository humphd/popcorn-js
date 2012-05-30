
(function( YouTubeVideo, xtag ){

  xtag.register( "video", (function(){

    // Process src last, so other attributes can popluate instance before loading.
    var attrs = "autoplay preload controls loop poster muted width height src".split( " " );

    return {
      onCreate: function(){
        var video = this.xtag.video = new YouTubeVideo( this ),
            elem = this;

        attrs.forEach( function( attr ){
          video[ attr ] = elem.getAttribute( attr );
        });
      },

      setters: (function(){
        var setters = {};
        attrs.forEach( function( attr ){
          setters[ attr ] = function( value ){
            this.setAttribute( attr, value );
            this.video[ attr ] = value;
          };
        });

        return setters;
      }())

    };

  }()));

}( HTMLYouTubeVideoElement, xtag ));
