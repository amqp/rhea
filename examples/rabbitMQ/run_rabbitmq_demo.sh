#!/bin/bash
# Demo script for AMQP 1.0 with RabbitMQ

# Colors for better readability
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${BLUE}=== AMQP 1.0 Demo with RabbitMQ ===${NC}"

# Check if RabbitMQ is running
echo -e "${YELLOW}Checking if RabbitMQ is running...${NC}"
# Use systemctl to check service status
if ! systemctl is-active --quiet rabbitmq-server; then
    echo -e "${RED}RabbitMQ doesn't seem to be running. Try starting it with:${NC}"
    echo "sudo systemctl start rabbitmq-server"
    exit 1
else
    echo -e "${GREEN}RabbitMQ is running.${NC}"
fi

# --- Rest of the script (Queue Setup, Sender, Receiver) ---

# Configure queue for the demo
echo -e "${YELLOW}Configuring test queue...${NC}"
# Use default host/port for management API as per guide
node rabbitmq_queue_setup.js --host=localhost --port=15672
echo -e "${GREEN}Queue 'test_queue' created.${NC}"

# Start the receiver in the background
echo -e "${YELLOW}Starting the receiver in the background...${NC}"
# Use default host/port for AMQP connections as per guide
node rabbitmq_receiver.js -c 5 --host=localhost --port=5672 > receiver_output.log 2>&1 &
RECEIVER_PID=$!
echo -e "${GREEN}Receiver started with PID ${RECEIVER_PID}${NC}"

# Wait a bit to allow the receiver to connect
sleep 2

# Send messages
echo -e "${YELLOW}Sending 5 messages...${NC}"
# Use default host/port for AMQP connections as per guide
node rabbitmq_sender.js -c 5 -i 500 --host=localhost --port=5672

# Wait for the receiver to process all messages
echo -e "${YELLOW}Waiting for the receiver to process all messages...${NC}"
# Wait up to 10 seconds for the receiver process to finish
for i in {1..10}; do
    if ! kill -0 $RECEIVER_PID 2>/dev/null; then
        break # Receiver process has exited
    fi
    echo "Waiting... ($i/10)"
    sleep 1
done

# If the receiver is still running after the wait, terminate it
if kill -0 $RECEIVER_PID 2>/dev/null; then
    echo "The receiver is still running. Terminating..."
    kill $RECEIVER_PID
fi

# Show the receiver output
echo -e "${BLUE}=== Receiver Output ===${NC}"
cat receiver_output.log
# Clean up the log file
rm receiver_output.log

echo -e "${BLUE}=== Demo Completed ===${NC}"
echo -e "${GREEN}You have successfully sent and received messages using AMQP 1.0 with RabbitMQ!${NC}"

# Optional cleanup
read -p "Do you want to clean the test queue? (y/n) " -n 1 -r
echo # Move to a new line after the read prompt
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Use default host/port for management API for purge
    node rabbitmq_queue_setup.js -p --host=localhost --port=15672
    echo -e "${GREEN}Cleanup completed.${NC}"
fi
