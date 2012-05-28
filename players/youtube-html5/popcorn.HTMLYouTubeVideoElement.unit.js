
// TODO: more tests from http://w3c-test.org/html/tests/approved/video

var videoSrc = "http://www.youtube.com/watch?v=nfGV32RNkhw";

test( "canPlayType for YouTube", function(){

  var video = new HTMLYouTubeVideoElement( "#video" );
  equal( video.canPlayType( "garbage" ), "", "Report empty string if we can't play the type" );
  equal( video.canPlayType( videoSrc ), "probably", "Report probably if we can play the type" );

});


test( "currentSrc", function(){

  var video = new HTMLYouTubeVideoElement( "#video" );
  equal( video.currentSrc, "", "currentSrc is empty if there is no source" );

  video.src = videoSrc;
  notEqual( video.currentSrc, "", "currentSrc is not empty after setting src" );

});


test( "error", function(){

  var video = new HTMLYouTubeVideoElement( "#video" );
  equal( video.error, null, "error is null if no source" );

});


test( "error when video parameter is bad", function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "error", function() {
    equal( video.error.code, video.MEDIA_ERR_ABORTED, "MEDIA_ERR_ABORTED when param is invalid." );
    start();
  }, false);

  video.src = "http://www.youtube.com/watch?v=aaaaaaaaaaa";

});


test( "muted", function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  equal( video.muted, false, "muted is false by default" );

  video.muted = true;
  equal( video.muted, true, "muted is true" );

});


asyncTest( "volumechange for volume", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "volumechange", function() {
    video.pause();
    equal( video.volume, 0.5, "volumechange fires when volume is changed" );
    start();
  }, false);

  video.src = videoSrc;
  video.volume = 0.5;
  video.play();

});


/** TODO...
asyncTest( "volumechange for muted", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "volumechange", function() {
    video.pause();
    ok( video.muted, "volumechange fires when muted is changed" );
    start();
  }, false);

  video.src = videoSrc;
  video.muted = true;
  video.play();

});
***/

test( "Volume values", function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.volume = 0;
  equal( video.volume, 0, "Setting volume to 0" );

  video.volume = 1;
  equal( video.volume, 1, "Setting volume to 1" );

  // Invalid volume values (outside 0.0 to 1.0)
  raises( function(){ video.volume = -0.1; } );
  raises( function(){ video.volume = 1.1; } );

});


test( "networkState", function(){

  var video = new HTMLYouTubeVideoElement( "#video" );
  equal( video.networkState, video.NETWORK_EMPTY, "networkState is initially NETWORK_EMPTY" );

});


asyncTest( "canplay event", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "canplay", function() {
    video.pause();
    ok( true, "canplay fired" );
    start();
  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});


asyncTest( "readyState in canplay", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "canplay", function() {
    video.pause();
    ok( video.readyState >= video.HAVE_FUTURE_DATA,
        "video.readyState should be >= HAVE_FUTURE_DATA during canplay event" );
    start();
  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});


asyncTest( "readyState in canplaythrough", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "canplaythrough", function() {
    video.pause();
    equal( video.readyState, video.HAVE_ENOUGH_DATA,
           "video.readyState should be HAVE_ENOUGH_DATA during canplaythrough event" );
    start();
  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});


asyncTest( "readyState in loadedmetadata", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "loadedmetadata", function() {
    video.pause();
    equal( video.readyState, video.HAVE_METADATA,
        "video.readyState should >= HAVE_METADATA during loadedmetadata event" );
    start();
  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});


asyncTest( "canplaythrough event", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "canplaythrough", function() {
    video.pause();
    ok( true, "canplaythrough fired" );
    start();
  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});


asyncTest( "canplay, canplaythrough event order", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" ),
      canplay = false;

  video.addEventListener( "canplay", function() {
    canplay = true;
  }, false);

  video.addEventListener( "canplaythrough", function() {
    video.pause();
    ok( canplay, "canplay before canplaythrough" );
    start();
  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});


asyncTest( "canplay, playing event order", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" ),
      canplay = false;

  video.addEventListener( "canplay", function() {
    canplay = true;
  }, false);

  video.addEventListener( "playing", function() {
    video.pause();
    ok( canplay, "canplay before playing" );
    start();
  }, false);

  video.autoplay = true;
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


asyncTest( "pause event", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "pause", function() {
    ok( true, "pause() triggers pause" );
    start();
  }, false);

  video.autoplay = true;
  video.src = videoSrc;
  video.pause();

});


asyncTest( "play event", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "play", function() {
    video.pause();
    ok( true, "play event triggered by autoplay" );
    start();
  }, false);

  video.autoplay = true;
  video.src = videoSrc;

});


asyncTest( "playing event", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "playing", function() {
    video.pause();
    ok( true, "playing event triggered by autoplay" );
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


asyncTest( "Setting src loads video, triggers loadedmetadata, sets currentSrc", 1, function(){

  var video = new HTMLYouTubeVideoElement( "#video" );

  video.addEventListener( "loadedmetadata", function(){
    equal( videoSrc, video.currentSrc, "currentSrc is set in loadedmetadata" );
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
