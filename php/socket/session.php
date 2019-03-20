<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 30/01/19
 * Time: 14.39
 */

use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\Handler;
use Symfony\Component\HttpFoundation\Session\Storage\NativeSessionStorage;
use Symfony\Component\HttpFoundation\Session\Storage\Handler\MemcacheSessionHandler;


require 'composer/vendor/autoload.php';

$memchache = new Memcache;
$memchache->connect('localhost', 8090);

$storage = new NativeSessionStorage(
    array(),
    new MemcacheSessionHandler($memchache)
);

$session = new Session($storage);
$session->start();
