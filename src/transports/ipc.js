/**
 * IPC transport methods
 * @module transports.IPC
 */

'use strict';

/* Requires ------------------------------------------------------------------*/

const net = require('net');
const fs = require('fs');

/* Local variables -----------------------------------------------------------*/

const _path = '/tmp/app.socket-';

/* Methods -------------------------------------------------------------------*/

/**
 * @param {object} handlers The server handlers
 * @param {object} options The options for the listener
 * @returns {Promise(object)} The new listener
 */
function listen(handlers, options) {
  return new Promise(resolve => {
    const listener = net.createServer(handlers.handleConnection);
    listener.on('error', handlers.handleError);
    listener.listen(_path + options.port, resolve.bind(null, listener));
  });
}

/**
 * @param {Socket} socket a socket handle
 * @returns {object} The host and port info for that socket
 */
function getOrigin(socket) {
  return {
    host: socket._server._pipeName,
    port: '' + socket._handle.fd
  };
}

/**
 * @param {Client} client The client to create the socket for
 * @returns {Socket} The created ipc socket
 */
function createSocket(client) {
  return net.connect(_path + client.port);
}

/**
 * @param {Socket} socket A socket handle
 * @param {object} handlers A collection of handlers to attach
 */
function attachSocket(socket, handlers) {
  socket.on('data', handlers.handleRequest);
  socket.on('error', handlers.handleError);
  socket.on('connect', handlers.handleConnect);
  socket.on('close', handlers.handleDisconnect);
  socket.setTimeout(handlers.socketTimeout);
}

/**
 * @param {Server} server The server object
 * @param {function} callback The success callback for the operation
 */
function stop(server, callback) {
  server.listener.close(() => setTimeout(callback, 0));
}

/**
 * @param {Socket} socket The socket to use
 * @param {Buffer} payload The body of the request
 */
function send(socket, payload) {
  socket.write(payload);
}

/**
 * @param {Client} client The client to disconnect
 * @param {function} callback The callback method
 */
function disconnect(client, callback) {
  client.socket.end();
  client.socket.destroy();
  setTimeout(callback, 0);
}

/* Exports -------------------------------------------------------------------*/

module.exports = { listen, getOrigin, stop, send, disconnect, createSocket, attachSocket };