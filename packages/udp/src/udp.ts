/* Requires ------------------------------------------------------------------*/

import dgram from 'dgram';

/* Methods -------------------------------------------------------------------*/

function udp({ type = 'udp4', localAddr = '0.0.0.0', reuseAddr = true, socketTimeout = 30000, connectTimeout = 1000,
}: UDPConfig = {}): KalmTransport {
  return function socket(params: ClientConfig, emitter: NodeJS.EventEmitter): Socket {
    let listener: dgram.Socket;
    const clientCache: UDPClientList = {};

    function addClient(client: Client): void {
      const local: Remote = client.local();
      const key: string = `${local.host}.${local.port}`;

      // Client connection - skip
      if (local.host === params.host && local.port === params.port) return;
      clientCache[key].client = client;
      clientCache[key].timeout = setTimeout(client.destroy, socketTimeout);

      for (let i = 0; i < clientCache[key].data.length; i++) {
        clientCache[key].client.emit('frame', clientCache[key].data[i]);
      }
      clientCache[key].data.length = 0;
    }

    function remote(handle: SocketHandle): Remote {
      return handle as Remote;
    }

    function send(handle: UDPSocketHandle, payload: Buffer | number[]): void {
      if (handle) {
        handle.socket.send(Buffer.from(payload as number[]), handle.port, handle.host);
      }
    }

    function stop(): void {
      listener.close();
    }

    function disconnect(handle?: UDPSocketHandle): void {
      if (handle && handle.socket) handle.socket = null;
      emitter.emit('disconnect');
    }

    function connect(handle?: SocketHandle): SocketHandle {
      if (handle) return handle;
      const connection = dgram.createSocket(type as dgram.SocketType);
      let timeout: NodeJS.Timeout;
      connection.on('error', err => emitter.emit('error', err));
      connection.on('message', req => {
        // Handle ACK
        if (req[0] === 65 && req[1] === 67 && req[2] === 75) {
          clearTimeout(timeout);
          emitter.emit('connect', connection);
        } else emitter.emit('rawFrame', req);
      });
      connection.bind(null, localAddr);

      const res = {
        host: params.host,
        port: params.port,
        socket: connection,
      };

      // Ping test
      send(res, Buffer.from('SYN'));
      timeout = setTimeout(() => disconnect(res), connectTimeout);

      return res;
    }

    function resolveClient(origin, data) {
      const handle: UDPSocketHandle = {
        host: origin.address,
        port: origin.port,
        socket: listener,
      };
      let isSynPacket = false;

      // Handle SYN
      if (data[0] === 83 && data[1] === 89 && data[2] === 78) {
        send(handle, Buffer.from('ACK'));
        isSynPacket = true;
      }

      const key: string = `${origin.address}.${origin.port}`;
      clearTimeout(clientCache[key] && clientCache[key].timeout);

      if (!clientCache[key]) {
        clientCache[key] = {
          client: null,
          data: [],
          timeout: null,
        } as UDPClient;
        emitter.emit('socket', handle);
      }

      if (data && !isSynPacket) {
        if (clientCache[key].client) clientCache[key].client.emit('rawFrame', data);
        else clientCache[key].data.push(data);
      }
    }

    function bind(): void {
      listener = dgram.createSocket({ type: type as dgram.SocketType, reuseAddr });
      listener.on('message', (data, origin) => resolveClient(origin, data));
      listener.on('error', err => emitter.emit('error', err));
      listener.bind(params.port, localAddr);
      emitter.emit('ready');
    }

    emitter.on('connection', addClient);

    return {
      bind,
      connect,
      disconnect,
      remote,
      send,
      stop,
    };
  };
}

/* Exports -------------------------------------------------------------------*/

module.exports = udp;
