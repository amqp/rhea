const opentracing = require('opentracing');
const container = require('rhea');

module.exports.client = function(url, requests, args, baseT){
    let span;
    this.url = url;
    this.requests_queued = [];
    this.requests_outstanding = [];
    this.receiver;
    this.sender =1;

    let add_request = (e) => {
        tags = { 'request': e};
        span = opentracing.globalTracer().startSpan('request', { childOf: baseT }, tags=tags);

        // console.log("her her")
        id = container.generate_uuid();
        this.requests_queued.push( [id, e, span] );
        // span.finish()
    };
  
    requests.forEach(e => {
        add_request(e);
    });
  
    let pop_request = (id) => {
        let temp;
        this.requests_outstanding.forEach(e => {
        if(e[0]==id){
          temp = e;
        }
      })
      return this.requests_outstanding.splice(temp,1);;
    }
  
    container.on('connection_open',(e) => {
        this.sender = e.connection.open_sender(args.node);
        this.receiver = e.connection.open_receiver({source:{address:url,dynamic:true}});
    });


    container.on('receiver_open',(z) => {
        this.receiver = z.receiver;
        if(this.receiver.source.address != undefined && this.receiver.source.address != null){
                while(this.requests_queued.length > 0){
                    next_request();
                }
        }
    });

    let next_request = () => {
      if(this.receiver.source.address != undefined || this.receiver.source.address != null ){
        [id, req, span] = this.requests_queued.pop();
        opentracing.globalTracer().active = span;     
        span.log({'event': 'request-sent'});
        msg = { reply_to: this.receiver.source.address, correlation_id: id, body: req };
        this.sender.send(msg);
        this.requests_outstanding.push([id, req, span]);
        span.finish();
      }
    }
  
    container.on('message', (e) => {
      id=e.message.correlation_id;
      reply = e.message.body;
      popVal = pop_request(id);
      if(popVal[0] != undefined){
        req = popVal[0][0];
        tester = popVal[0][1];
        span = popVal[0][2];
      } 
      span.log({'event': 'reply-received', 'result': reply});
      span.finish();
      console.log(`${tester} => ${reply}`);
      if(this.requests_queued.length > 0){
         next_request();
      } else if(this.requests_outstanding.length == 0) {
        e.connection.close();
      }
    })
  };