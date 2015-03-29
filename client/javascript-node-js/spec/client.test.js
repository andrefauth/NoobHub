var should = require('should');
var sinon = require('sinon');
var _ = require('lodash')
var net  = require('net');
var nbhb = require('../client.js');


describe('Server communication', function() {

    describe('connect', function() {
      this.timeout(5000);
      var _socket;

      beforeEach(function(done) {
        _socket = new net.Socket({});

        sinon.stub(_socket, 'connect', function( port, host, connectListener ) {
          port === 1337 && host === '127.0.0.1' && connectListener()
        });

        sinon.stub(_socket, 'write', function(data, encoding, cb) {
          var data = data || '';

          if ( data.indexOf("__SUBSCRIBE__") !== -1 && data.indexOf("__ENDSUBSCRIBE__") !== -1 ) {
            this.emit( 'data', new Buffer('Hello. Noobhub online. \r\n') )
          } else {
            data && this.emit( 'data', new Buffer(data.toString()) )
          }
          cb && cb()
        })

        done()
      })

      afterEach(function(done) {
        _socket && _socket.destroy()
        done()
      })


      it('should initiate a connection with a remote server and call error callback if server is not responding', function(done) {

        var client = nbhb.createClient( 
          { host: '8.8.8.8', port: 1337, channel: 'gsom', debug: true,
            onError: function onError(err){
              should.exist(err);
              err.message.should.eql('Connection timeout'); 
              done(); 
            }
          });
          client.connect();
      })


      it('should connect to localhost', function(done) {
        var client = nbhb.createClient(
          { debug: true, socket: _socket,
            onError: function onError(err){}
          })
        client.connect(function onConnect(){
          should.exist(true)
          done()
        })
      })

      it('should subscribe to a channel', function(done) {
        var client = nbhb.createClient({ debug: true, socket: _socket});
        client.connect( function() {
          client.subscribe('gsom', function () {
            should.exist(true)
            done()
          })
        })
      })

      it('should publish a message and get it back', function(done) {
        var client = nbhb.createClient({ debug: true, socket: _socket })
        client.connect( function onConnect() {
          client.publish('any')
        }, function onMessage( msg ) {
          msg.should.eql('any')
          done()
        })
      })

      it('should split a chunk with multiple messages', function(done) {
        _socket.emitMultipleMsg = function() {
          var d = "__JSON__START__message#1__JSON__END__" + "__JSON__START__message#2__JSON__END__";
          this.emit('data', new Buffer(d.toString()))
        }

        var client = nbhb.createClient({ debug: true, socket: _socket })

        var spyOnMessage = sinon.spy(
          function ( msg ) {
            spyOnMessage.calledOnce && msg.should.eql('message#1')
            spyOnMessage.calledTwice && msg.should.eql('message#2') && done()
        });

        client.connect( function onConnect() {
          should.exist(true)
          _socket.emitMultipleMsg()
        }, spyOnMessage)
      })

    })

});