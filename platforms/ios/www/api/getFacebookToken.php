<?php

//Set these headers to avoid any issues with cross origin resource sharing issues
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type,x-prototype-version,x-requested-with');


header('Content-Type: text/html');

if(!isset($_GET['token']))
    die("Token not given");

$token = $_GET['token'];

$extend_url = "https://graph.facebook.com/oauth/access_token?client_id=1442526929123214&client_secret=359b7e16d9a0cf31493cfc62697f5dc3&grant_type=fb_exchange_token&fb_exchange_token=".$token;

$resp = file_get_contents($extend_url);

parse_str($resp,$output);

$extended_token = $output['access_token'];

echo $extended_token;
?>
