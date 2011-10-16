// PLUGIN: pdf

(function (Popcorn, document) {

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


  /**
   * Cached PDFDoc objects
   */
  var docCache;

  function loadPdf(url, callback) {
    getPdf(
      {
        url: url,
        error: function() {
          // TODO: need to log this somewhere...
          console.log('unable to load doc `' + url + '`');
        }
      },
      function(data) {
        console.log(url,data);
        var pdf = new PDFDoc(data);
        docCache[url] = pdf;
        callback(pdf);
      }
    );
  }

  function renderPage(options) {
    var canvas = options.canvas,
      ctx = canvas.getContext('2d'),
      page = options.page,
      width = options.width || page.width,
      height = options.height || page.height,
      callback = options.callback || function() {};

    canvas.width = width;
    canvas.height = height;
    canvas.mozOpaque = true;

    ctx.save();
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    page.startRendering(ctx, callback);
  }

  Popcorn.plugin( "pdf" , {

    manifest: {
      about:{
        name: "Popcorn PDF Plugin",
        version: "0.1",
        author: "@humphd",
        website: "http://vocamus.net/dave"
      },
      options:{
        start      : {elem:'input', type:'text', label:'In'},
        end        : {elem:'input', type:'text', label:'Out'},
        target     : 'pdf-container',
        width      : {elem:'input', type:'text', label:'Width'},
        height     : {elem:'input', type:'text', label:'Height'},
        pdfUrl     : {elem:'input', type:'text', label:'Line'},
        pageNumber : {elem:'input', type:'text', label:'Gist URL'}
      }
    },

    _setup: function(options) {
      docCache = {};
    },

    /**
     * @member footnote 
     * The start function will be executed when the currentTime 
     * of the video  reaches the start time provided by the 
     * options variable
     */
    start: function(event, options) {
      var url = options.pdfUrl,
        page = options.pageNumber,
        canvas = options.__canvas = document.createElement('canvas'),
        ctx;

      // TODO: support "next page" and "previous page"

      var container = document.getElementById(options.target);
      container.appendChild(canvas);

      if (!docCache[url]) {
        loadPdf(url, function(pdf) {
          renderPage({
            page: pdf.getPage(page),
            canvas: canvas,
            callback: function() {
              console.log('done rendering page');
            }
          });
        });
      }

      var pdf = docCache[url];
      renderPage({
        page: pdf.getPage(page),
        canvas: canvas,
        callback: function() {
          console.log('done rendering page');
        }
      });
    },

    /**
     * @member footnote 
     * The end function will be executed when the currentTime 
     * of the video  reaches the end time provided by the 
     * options variable
     */
    end: function(event, options){
      var canvas = options.__canvas;

      if (!canvas) {
        return;
      }

      var container = document.getElementById(options.target);
      container.removeChild(canvas);
      delete options.__canvas;
    },

    _teardown: function( options ) {
      docCache = null;
    }

  });

})( Popcorn, window.document );
