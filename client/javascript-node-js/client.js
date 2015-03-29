
var net = require('net')
  , _ = require('lodash');

module.exports = {
  createClient: function( config ) {

    var subscribe = function( channel ) {
        return "__SUBSCRIBE__" +channel+ "__ENDSUBSCRIBE__"
      }
      , say = function( msg ) {
        return "__JSON__START__" +msg+ "__JSON__END__"
      };

    var Client = function Client( config ) {
      var debug = config && config.debug;
      var onError = config && config.onError || function(){};
      var onSubscribe = function() {};

      var me = this
      , socket = debug && config.socket || null
      , _log = function(msg) {
        debug && console.log.apply( console, arguments );
      };

      me.options = _.extend({

        host: '127.0.0.1',
        port: 1337,
        channel: 'msxfm',
        nodelay: true,
        timeout: 2000,
        debug: false

      }, config || {});

      var _initSocket = function _initSocket() {
        socket = socket || new net.Socket();
        me.options.nodelay && socket.setNoDelay(true);
        socket.isConnected = false;

        socket.on('data', function( chunk ) {
          _log('got %d bytes of data\r\n', chunk.length);
          
          var messages =  String( chunk ).split( '__JSON__END____JSON__START__' )
            , first = messages[0]
            , l = messages.length
            , last = messages[l-1];

          if ( l === 1 ) {

            if ( messages[0].indexOf('__JSON__START__') !== -1 && messages[0].indexOf('__JSON__END__') !== -1 ) {
              messages[0] = messages[0].replace(/__JSON__START__|__JSON__END__|\r|\n/g, '');
            } else if ( messages[0].indexOf('Hello. Noobhub online.') !== -1 ) {
              return onSubscribe();
            }
          } else if ( l > 1 ){
          // tail of previous message
            if (first.indexOf('__JSON__START__') === -1) {
              messages[0] = socket.buffer + first;
              socket.buffer = null;
            } else {
              messages[0] = first.substr(15);
            }
          // head of message non-ended
            if (last.indexOf('__JSON__END__') === -1) {
              socket.buffer = last;
              messages.pop();
            } else {
              messages[l-1] = last.substr(0, last.length-13);
            }
          }

          messages.forEach(function( message ) {
            _log('Received: %s\r\n', message)
            me.receive( message )
          })
        })


        socket.on('error', function(err) {
          _log(err)
          socket.isConnected = false;
          socket.buffer = null
          socket.destroy()
          onError && onError(err)
        })


        socket.on('close', function() {
          _log('Socket was closed.\r\n')
          socket.isConnected = false;
          socket.buffer = null
        })
      };


      _initSocket()


      // public API

      me.connect = function ( onConnect, onMessage ) {
        _log('connecting to %s %s', me.options.host, me.options.port);
        me.receive = onMessage || function() {};
        socket.setTimeout( me.options.timeout, function() {
          _log('Connection timeout.\r\n')
          onError && onError(new Error('Connection timeout'))
        } );
        socket.connect( me.options.port, me.options.host, function() {
          _log('Connected\r\n')
          socket.isConnected = true;
          socket.setTimeout(0);
          onConnect && onConnect()
        });
      }

      me.subscribe = function( channel, onSub, onMes ) {
        onSubscribe = onSub || onSubscribe

        if ( !socket.isConnected ) {
          me.connect( function() {
            socket && socket.write( subscribe( channel ) )
          }, onMes)
        } else {
            socket && socket.write( subscribe( channel ) )
        }
      }

      me.publish = function( msg, onSent ) {
        socket && socket.write( say( msg ), function(){ _log('Message sent\r\n') } )
      }

      me.disconnect = function() {
        socket && socket.end()
      }
    }

    return new Client(config)

  }
}
