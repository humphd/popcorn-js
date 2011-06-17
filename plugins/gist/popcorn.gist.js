// PLUGIN: Gist

(function (Popcorn) {

  /**
   * Github Gist popcorn plug-in
   * Loads and allows lines of code in a gist to be highlighted.
   *
   * @param {Object} options
   *
   * Example:
   *  var p = Popcorn('#video')
   *     .gist({
   *       start: 5, // seconds
   *       end: 15, // seconds
   *       lines: '25', // line(s) to highlight and show
   *       target: 'gist-container', // DIV in which to load gist
   *       gistUrl: 'https://gist.github.com/289467' // URL of gist
   *     })
   *     // The specified "line" can also be a list
   *     .gist({
   *       start: 20, // seconds
   *       end: 25, // seconds
   *       lines: '26,29-32', // line(s) to highlight and show
   *       target: 'gist-container', // DIV in which to load gist
   *       gistUrl: 'https://gist.github.com/289467' // URL of gist
   *     })
   *     // Highlighting can be removed
   *     .gist({
   *       start: 20, // seconds
   *       end: 25, // seconds
   *       lines: null // line(s) to highlight and show
   *       target: 'gist-container', // DIV in which to load gist
   *       gistUrl: 'https://gist.github.com/289467' // URL of gist
   *     });
   */

  function unhighlight() {
    console.log('unhighlight');
  }

  function highlight(line) {
    console.log('highlight');
  }

  function scrollTo(line) {

  }

  var gists = {};

  function loadGist(url, target) {
    var container = document.getElementById(target);
    var script = document.createElement('script');
    container.appendChild(script);

    var gistId = url.match(/gist\.github\.com\/(\d+)/)[1];
    script.src = 'https://gist.github.com/' + gistId + '.js';

    gists[url] = script;




  }

  Popcorn.plugin( "gist" , {

    manifest: {
      about:{
        name: "Popcorn Gist Plugin",
        version: "0.1",
        author: "@humphd",
        website: "http://vocamus.net/dave"
      },
      options:{
        start    : {elem:'input', type:'text', label:'In'},
        end      : {elem:'input', type:'text', label:'Out'},
        target   : 'gist-container',
        line     : {elem:'input', type:'text', label:'Line'},
        gistUrl  : {elem:'input', type:'text', label:'Gist URL'}
      }
    },
    _setup: function(options) {
    },
    /**
     * @member footnote 
     * The start function will be executed when the currentTime 
     * of the video  reaches the start time provided by the 
     * options variable
     */
    start: function(event, options) {
      if (!gists[options.gistUrl]) {
        loadGist(options.gistUrl, options.target);
      }

      if (!options.lines) {
        unhighlight();
      } else {
        var lines = [];
        Popcorn.forEach( options.lines.split(','), function ( item, i ) {
          var range = item.split('-');
          if (range.length === 1) {
            lines.push(parseInt(range[0], 10));
          } else {
            for (var i = parseInt(range[0],10); i < parseInt(range[1],10)+1; i++) {
              lines.push(i);
            }
          }
        } );
        console.log(options.start, lines);
      }
    },
    /**
     * @member footnote 
     * The end function will be executed when the currentTime 
     * of the video  reaches the end time provided by the 
     * options variable
     */
    end: function(event, options){
      unhighlight();
    },
    _teardown: function( options ) {

    }
  });

})( Popcorn );
