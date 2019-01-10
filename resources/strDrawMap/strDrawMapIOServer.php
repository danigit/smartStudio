<?php
use Ratchet\Server\IoServer;
use strDrawMapApp\strWebSocketHandler;

    require dirname(__DIR__) . '\strDrawMap\vendor\autoload.php';

    $server = IoServer::factory(
        new strWebSocketHandler(),
        8080
    );

    $server->run();
?>