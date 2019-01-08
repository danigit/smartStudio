<?php
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use strDrawMapApp\strWebSocketHandler;
use strDrawMapApp\strDrawMapProtocol;

    require 'SystemConfig.php';

    require dirname(__DIR__) . AUTOLOAD_POSITION;

    $server = IoServer::factory(
        new HttpServer(
            new WsServer(
                new strWebSocketHandler()
            )
        ),
        8080
    );

    $server->run();
?>