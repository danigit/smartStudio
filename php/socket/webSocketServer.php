<?php /** @noinspection PhpUndefinedFieldInspection */

/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 14/01/19
 * Time: 19.58
 */

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class webSocketServer implements MessageComponentInterface{
    protected $clients;

    public function __construct(){
        echo "SERVER IS LISTENING...\n\n";
        $this->clients = new \SplObjectStorage;
    }

    /**
     * When a new connection is opened it will be passed to this method
     * @param  ConnectionInterface $conn The socket/connection that just connected to your application
     * @throws \Exception
     */
    function onOpen(ConnectionInterface $conn){
        // TODO: Implement onOpen() method.
        echo "CONNECTION ESTABLISHED WITH ({$conn->resourceId})!\n";
        $this->clients->attach($conn);
    }

    /**
     * This is called before or after a socket is closed (depends on how it's closed).  SendMessage to $conn will not result in an error if it has already been closed.
     * @param  ConnectionInterface $conn The socket/connection that is closing/closed
     * @throws \Exception
     */
    function onClose(ConnectionInterface $conn){
        // TODO: Implement onClose() method.
        $this->clients->detach($conn);
    }

    /**
     * If there is an error with one of the sockets, or somewhere in the application where an Exception is thrown,
     * the Exception is sent back down the stack, handled by the Server and bubbled back up the application through this method
     * @param  ConnectionInterface $conn
     * @param  \Exception $e
     * @throws \Exception
     */
    function onError(ConnectionInterface $conn, \Exception $e){
        // TODO: Implement onError() method.
        echo "An error has occurred: {$e->getMessage()}\n";

        $conn->close();
    }

    /**
     * Triggered when a client sends data through the socket
     * @param  \Ratchet\ConnectionInterface $from The socket/connection that sent the message to your application
     * @param  string $msg The message received
     * @throws \Exception
     */
    function onMessage(ConnectionInterface $from, $msg){
        // TODO: Implement onMessage() method.
        $numRecv = count($this->clients) - 1;
        echo sprintf('Connection %d sending message "%s" to %d other connection%s' . "\n"
            , $from->resourceId, $msg, $numRecv, $numRecv == 1 ? '' : 's');

        foreach ($this->clients as $client) {
                // The sender is not the receiver, send to each client connected
                echo "Sending message to: " . $client->resourceId . "\n";
                $client->send($msg);
        }
    }
}