/*
 * Script for RabbitMQ queue configuration
 */
const http = require("http");

var args = require("./options.js")
  .options({
    n: {
      alias: "queue",
      default: "test_queue",
      describe: "name of the queue to create",
    },
    e: {
      alias: "exchange",
      describe: "name of the exchange to connect the queue to (optional)",
    },
    r: {
      alias: "routing_key",
      describe: "routing key for binding (default is queue name)",
    },
    d: {
      alias: "durable",
      type: "boolean",
      default: true,
      describe: "make the queue durable",
    },
    a: {
      alias: "auto_delete",
      type: "boolean",
      default: false,
      describe: "auto-delete the queue when not in use",
    },
    x: {
      alias: "delete",
      type: "boolean",
      default: false,
      describe: "delete the queue instead of creating it",
    },
    p: {
      alias: "purge",
      type: "boolean",
      default: false,
      describe: "purge all messages from the queue",
    },
    u: {
      alias: "username",
      default: "guest",
      describe: "username for RabbitMQ management API",
    },
    w: {
      alias: "password",
      default: "guest",
      describe: "password for RabbitMQ management API",
    },
    h: {
      alias: "host",
      default: "localhost",
      describe: "hostname of the RabbitMQ server",
    },
    P: {
      alias: "port",
      default: 15672,
      describe: "port for RabbitMQ management API",
    },
  })
  .help("help").argv;

// Create authentication header
const auth =
  "Basic " +
  Buffer.from(`${args.username}:${args.password}`).toString("base64");

// Configure API client
const apiOptions = {
  hostname: args.host,
  port: args.port,
  headers: {
    Authorization: auth,
    "Content-Type": "application/json",
  },
};

// Function to make API requests
function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      ...apiOptions,
      method: method,
      path: path,
    };

    const req = http.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(responseData ? JSON.parse(responseData) : {});
          } catch (e) {
            resolve(responseData);
          }
        } else {
          reject(
            new Error(
              `API request failed with status ${res.statusCode}: ${responseData}`
            )
          );
        }
      });
    });

    req.on("error", (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Main function
async function main() {
  try {
    // Get vhost (using default '/')
    const vhost = "/";
    const encodedVhost = encodeURIComponent(vhost);

    // If delete flag is set, delete the queue
    if (args.delete) {
      console.log(`Deleting queue ${args.queue}...`);
      await makeRequest("DELETE", `/api/queues/${encodedVhost}/${args.queue}`);
      console.log(`Queue ${args.queue} successfully deleted.`);
      return;
    }

    // If purge flag is set, empty the queue
    if (args.purge) {
      console.log(`Purging queue ${args.queue}...`);
      await makeRequest(
        "DELETE",
        `/api/queues/${encodedVhost}/${args.queue}/contents`
      );
      console.log(`Queue ${args.queue} successfully purged.`);
      return;
    }

    // Create the queue
    console.log(`Creating queue ${args.queue}...`);
    await makeRequest("PUT", `/api/queues/${encodedVhost}/${args.queue}`, {
      durable: args.durable,
      auto_delete: args.auto_delete,
      arguments: {},
    });
    console.log(`Queue ${args.queue} successfully created.`);

    // If an exchange is specified, bind the queue to it
    if (args.exchange) {
      const routingKey = args.routing_key || args.queue;
      console.log(
        `Binding queue ${args.queue} to exchange ${args.exchange} with routing key ${routingKey}...`
      );
      await makeRequest(
        "POST",
        `/api/bindings/${encodedVhost}/e/${args.exchange}/q/${args.queue}`,
        {
          routing_key: routingKey,
          arguments: {},
        }
      );
      console.log(`Queue binding successfully completed.`);
    }
  } catch (error) {
    if (error.message) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

// Execute the main function
main();
