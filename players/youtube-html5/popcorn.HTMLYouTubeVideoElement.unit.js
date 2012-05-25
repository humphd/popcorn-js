
// TODO: more tests from http://w3c-test.org/html/tests/approved/video

var videoSrc = "http://www.youtube.com/watch?v=nfGV32RNkhw";

test( "canPlayType for YouTube", function(){

  var video = new HTMLYouTubeVideoElement( "#video" );
  equal( video.canPlayType( "garbage" ), "", "Report empty string if we can't play the type" );
  equal( video.canPlayType( videoSrc ), "probably", "Report probably if we can play the type" );

});


asyncTest( "canplay event", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "canplay", function() {
    video.pause();
    ok( true, "canplay through fired" );
    start();
  }, false);

  video.src = videoSrc;

});


asyncTest( "paused false during play", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "play", function() {
    ok( !video.paused, "paused is false while playing" );
    video.pause();
    start();
  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});


asyncTest( "paused is true when paused", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "pause", function() {
    ok( video.paused, "paused is true while paused" );
    start();
  }, false);

  video.src = videoSrc;
  video.play();
  video.pause();

});


asyncTest( "readyState during canplay", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "canplay", function() {
    ok( video.readyState >= video.HAVE_FUTURE_DATA, "readyState is > HAVE_FUTURE_DATA in canplay" );
    start();
  }, false);

  video.src = videoSrc;

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
    var currentTime = video.currentTime;

    video.removeEventListener( "seeked", onSeeked, false );
    eventOrder += "seeked";

    equal( eventOrder, "seekingseeked", "seeking then seeked" );
    equal( Math.floor( currentTime ), 100, "duration is 100 after seek ends" );

    video.pause();

    start();

  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});
