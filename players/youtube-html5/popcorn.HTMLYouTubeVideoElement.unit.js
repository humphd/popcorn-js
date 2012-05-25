
var videoSrc = "http://www.youtube.com/watch?v=nfGV32RNkhw";

test( "canPlayType for YouTube", function(){

  var video = new HTMLYouTubeVideoElement( "#video" );
  equal( video.canPlayType( "garbage" ), "", "Report empty string if we can't play the type" );
  equal( video.canPlayType( videoSrc ), "probably", "Report probably if we can play the type" );

});


asyncTest( "Setting src loads video, triggers metadataloaded, sets currentSrc", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "metadataloaded", function(){
    equal( videoSrc, video.currentSrc, "currentSrc is set in metadataloaded" );
    start();
  }, false);

  video.src = videoSrc;

});


asyncTest( "video.duration, durationchagne event", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "durationchange", function(){
    equal( video.duration, 151, "duration is set and durationchange fired." );
    start();
  }, false);

  video.src = videoSrc;

});


asyncTest( "currentTime, seeking, seeked", 2, function(){

  var video = new HTMLYouTubeVideoElement( "#video" ),
      eventOrder = "";

  video.addEventListener( "playing", function onPlaying(){
    video.removeEventListener( "playing", onPlaying, false );

    video.currentTime = 100;
  }, false);

  video.addEventListener( "seeking", function onSeek(){
    video.removeEventListener( "seeking", onSeek, false );
    eventOrder += "seeking";
  }, false);

  video.addEventListener( "seeked", function onSeeked(){
    video.removeEventListener( "seeked", onSeeked, false );
    eventOrder += "seeked";

    video.pause();

    equal( eventOrder, "seekingseeked", "seeking then seeked" );
    equal( Math.floor( video.currentTime ), 100, "duration is 100 after seek ends" );
    start();

  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});
