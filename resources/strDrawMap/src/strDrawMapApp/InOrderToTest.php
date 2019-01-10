<html>
<header></header>
<body>
 <?php
   include_once 'd:\\GoogleDrive\\Lavoro\\Progetti\\SmartTrack\\strDrawMap\\Software\\strDrawMap\\src\\strDrawMapApp\\strDrawMapConfig.php';
   include_once 'd:\\GoogleDrive\\Lavoro\\Progetti\\SmartTrack\\strDrawMap\\Software\\strDrawMap\\src\\strDrawMapApp\\strDrawMapProtocol.php';
   $ALoginObject = new TDrawMapProtocol(MYSQLSERVER,MYSQLDBASE,MYSQLACCOUNT,MYSQLPASSWORD);
   echo $ALoginObject->Login('saverio','');
 ?>
</body>
</html>