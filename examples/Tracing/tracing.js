const { initTracer: initJaegerTracer } = require("jaeger-client");
const opentracing = require('opentracing');
const container = require('rhea');

const _trace_key = ('x-opt-qpid-tracestate');


const initTracer = (serviceName) => {
  const config = {
    serviceName: serviceName,
    sampler: {
      type: "const",
      // priority: 1,
      param: 1,
      format: "proto",
    },
    reporter: {
      logSpans: true,
    },
  };
  const options = {
    logger: {
      info(msg) {
        console.log("INFO ", msg);
      },
      error(msg) {
        console.log("ERROR", msg);
      },
    },
  };
  return initJaegerTracer(config, options);
};

module.exports.testTracer = function test(serviceName){
  opentracing.initGlobalTracer(initTracer(serviceName));
  this.tracer = opentracing.globalTracer();
  opentracing.globalTracer.activeSpan = this.tracer;
  container.on('sender_open', (e) => {
    e.sender.send2 = e.sender.send;
    let testSender = (msg) => {
      connection = e.connection;
      let span_tags = {
        SPAN_KIND: opentracing.Tags.SPAN_KIND_MESSAGING_PRODUCER,
        MESSAGE_BUS_DESTINATION: e.sender.target.address,
        PEER_ADDRESS: (`amqp:://${e.sender.connection.options.host}:${e.sender.connection.options.port}/${e.sender.target.address}`),
        PEER_HOSTNAME: e.sender.connection.options.host, 
        'inserted_by': 'proton-message-tracing'
      }

      span = this.tracer.startSpan('amqp-delivery-send', { childOf: opentracing.globalTracer().active},tags=span_tags);
      headers = {};
      this.tracer.inject(span, opentracing.FORMAT_TEXT_MAP, headers);
  
      console.log(msg)
      if(msg.annotations == undefined){
          msg.annotations = { trace_key: headers}
      } else {
          msg.annotations[trace_key] = headers
      }

      delivery = e.sender.send2(msg);
      delivery.span = span;
  
      span.setTag('delivery-tag', delivery.tag)
  
      span.finish();
      return delivery;
    };
    e.sender.send = testSender;

    e.sender.on('settled',(e) => {
      if(e.delivery!=undefined || e.delivery!=null){
        delivery = e.delivery;
        //nasty fix not realistic nor correct
        if(e.delivery.remote_settled==true){
          state = 'ACCEPTED';
        } else {
          
        }
        span = delivery.span;
        span.setTag('delivery-terminal-state', state);
        span.log({'event': 'delivery settled', 'state': state});
        span.finish();
      }
    });
  });

  container.on('message', (e) => {
    let message = e.message;
    let receiver = e.receiver;
    let connection = e.connection;

    //hard coded tempoary stupid fix on peer address
    span_tags = {
      [opentracing.Tags.SPAN_KIND]: opentracing.Tags.SPAN_KIND_MESSAGING_CONSUMER,
      [opentracing.Tags.MESSAGE_BUS_DESTINATION]: receiver.source.address,
      [opentracing.Tags.PEER_ADDRESS]: (`amqp:://${connection.options.host}:${connection.options.port}/examples`),
      [opentracing.Tags.PEER_HOSTNAME]: connection.options.host,
      'inserted_by': 'proton-message-tracing'
    }

    if(message.message_annotations == undefined){
      ctx = this.tracer.startSpan('amqp-deliver-receive', tags = span_tags);
      ctx.finish();
    } else {
      headers = message.message_annotations[_trace_key];
      let abc = new Buffer(headers['uber-trace-id']);
      let cba = { 'uber-trace-id': abc.toString()};
      span_ctx = this.tracer.extract(opentracing.FORMAT_TEXT_MAP, cba);
      let wft = this.tracer.startSpan('amqp-delivery-receive', { childOf: span_ctx}, tags = span_tags);
      wft.finish();
    }
  });
}