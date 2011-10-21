// PLUGIN: pdf

(function (Popcorn, document) {

  /**
   * PDF popcorn plug-in
   * Loads and allows pages of a PDF file to be shown in a DIV.
   *
   * @param {Object} options
   *
   * Example:
   *  var p = Popcorn('#video')
   *     // Let the pdf plugin load your PDF file for you using pdfUrl.
   *     .pdf({
   *       start: 5, // seconds
   *       end: 15, // seconds
   *       pdfUrl: 'url-of-pdf-file', // the PDF file to use (will be loaded)
   *       pdfPage: 6, // show page 6 of this PDF
   *       target: 'pdf-container', // DIV in which to load gist
   *     })
   *     .pdf({
   *       start: 35, // seconds
   *       end: 75, // seconds
   *       pdfUrl: 'url-of-another-pdf-file', // the PDF file to use (will be loaded)
   *       preload: false, // Don't preload this, wait til we need it (default is preload=true)
   *       pdfPage: 6, // show page 6 of this PDF
   *       target: 'pdf-container', // DIV in which to load gist
   *     })
   *     // Manage loading the PDF file yourself using pdfDoc.
   *     .pdf({
   *       start: 16, // seconds
   *       end: 20, // seconds
   *       pdfDoc: myPreviouslyLoadedPDFDoc, // PDFDoc object already created
   *       pdfPage: 7, // show page 6 of this PDF
   *       target: 'pdf-container', // DIV in which to load gist
   *     })
   *     // Set your own width and height for the rendered page.
   *     .pdf({
   *       start: 21, // seconds
   *       end: 25, // seconds
   *       pdfDoc: myPreviouslyLoadedPDFDoc, // PDFDoc object already created
   *       pdfPage: 8, // show page 6 of this PDF
   *       width: 1024, // custom width to use instead of PDF's natural width
   *       height: 1024, // custom height to use instead of PDF's natural height
   *       target: 'pdf-container', // DIV in which to load gist
   *     });
   */


  /**
   * Cached PDFDoc objects.
   */
  var _docCache = {};

  /**
   * Helper function to load and cache a PDF document with callbacks
   */
  function loadPdf(url, callback, errback) {
    callback = callback || function() {};
    errback = errback || function() {};

    getPdf(
      {
        url: url,
        error: function() {
          // TODO: need to log this somewhere...
          console.log('unable to load doc `' + url + '`');
          errback();
        }
      },
      function(data) {
        var pdf = new PDFDoc(data);
        _docCache[url] = pdf;

        callback(pdf);
      }
    );
  }

  /**
   * Renders a single page of a PDF document.  Defaults to using the
   * natural dimensions of the page, unless alternate width/height
   * are given.
   */
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
        src        : {elem:'input', type:'text', label:'PDF URL'},
        // TODO: Not sure how to deal with pdfDoc, which can only be done with script
        // pdfDoc     : ???
        preload    : {elem:'input', type:'boolean', label:'Preload'},
        page       : {elem:'input', type:'number', label:'Page Number'}
      }
    },


    _setup: function(options) {
      var url = options.src,
        preload = options.preload === false ? false : true;

      if (url && preload && !_docCache[url]) {
        loadPdf(url);
      }
    },


    /**
     * Expect one of pdfDoc or src (must have one).  If we get
     * a pdfDoc object, it means the file has already been preloaded
     * and is ready to use (useful for larger PDF files).  Otherwise
     * we need to load it ourselves and manage it.
     */
    start: function(event, options) {
      var url = options.src,
        doc = options.pdfDoc,
        page = options.page || 1, // XXX: display first page if none given?
        width = options.width || 0,
        height = options.height || 0,
        container = document.getElementById(options.target),
        canvas = options.__canvas = document.createElement('canvas'),
        ctx;

      // TODO: need to cache/reuse canvas
      container.appendChild(canvas);

      function drawPage(pdf) {
        renderPage({
          page: pdf.getPage(page),
          canvas: canvas,
          width: width,
          height: height,
          callback: function() {
            // TODO
          }
        });
      }

      if (url && !_docCache[url]) {
        loadPdf(url, drawPage);
      }

      // Use the pdfDoc passed in, or get the document from our cache
      var pdf = doc && doc instanceof PDFDoc ? doc : _docCache[url];
      drawPage(pdf);
    },


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
