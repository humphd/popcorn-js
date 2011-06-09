#!/usr/bin/env python

from mimetypes import add_type

add_type('video/ogv', 'ogv', False)
add_type('audio/ogg', 'ogg', False)
add_type('video/webm', 'webm', False)

PORT = 9914

try:
  try:
    import SimpleHTTPServer
    import SocketServer

    Handler = SimpleHTTPServer.SimpleHTTPRequestHandler
    httpd = SocketServer.TCPServer(("localhost", PORT), Handler)
    print "Web Server listening on http://localhost:%s/ (stop with ctrl+c)..." % PORT
    httpd.serve_forever()

  except ImportError:
    from http.server import HTTPServer, SimpleHTTPRequestHandler

    httpd = HTTPServer(('localhost', 9914), SimpleHTTPRequestHandler)
    print "Web Server listening on http://localhost:%s/ (stop with ctrl+c)..." % PORT
    httpd.serve_forever()
except KeyboardInterrupt:
  pass
