<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 14/01/19
 * Time: 20.00
 */

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

require_once ('composer/vendor/autoload.php');
require_once ('webSocketServer.php');

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new webSocketServer()
        )
    ), 8090
);

$server->run();

//$loop = React\EventLoop\Factory::create();
//
//$webSocket = new React\Socket\Server('127.0.0.1:8090', $loop);
//$webSocket = new React\Socket\SecureServer($webSocket, $loop, [
//
//]);
//$server = IoServer::factory(
//    new HttpServer(
//        new WsServer(
//            new webSocketServer()
//        )
//    ), $webSocket,  $loop
//);
//
//$server->run();
?>