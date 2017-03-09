<?php
//Set these headers to avoid any issues with cross origin resource sharing issues
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type,x-prototype-version,x-requested-with');


header( "Content-type: application/json" );

if(!isset($_GET['query']) || !isset($_GET['password']) || $_GET['query'] != 'tafervendo')
    die("Query not defined or invalid password");



$servername = "tafervendo.mysql.uhserver.com";
$username = "giabeni";
$password = "25G08i98o@";
$db = "tafervendo";

function getAllPlaces($conn) {
    $sql = "SELECT * FROM places ORDER BY id";
    $statement=$conn->prepare($sql);
    $statement->execute();
    $results=$statement->fetchAll(PDO::FETCH_ASSOC);
    $json=json_encode($results);
    echo($json);
}

function getPlaceByPlaceId($conn, $place_id) {
    $sql = 'SELECT * FROM places WHERE place_id = :place_id';
    $statement=$conn->prepare($sql);
    $statement->bindParam(':place_id', $place_id, PDO::PARAM_INT);
    $statement->execute();
    $results=$statement->fetchAll(PDO::FETCH_ASSOC);
    $json=json_encode($results);
    echo($json);
}

function insertIfNotExists($conn, $place_id, $address, $name, $type, $lat, $long) {
    if(placeExists($conn, $place_id))
        return false;

    $sql = "INSERT IGNORE INTO `places` SET  
            `place_id` = :place_id,
            `address` = :address,
            `name` = :name,
            `type` = :type,
            `lat` = :lat,
            `lng` = :long";

    $statement=$conn->prepare($sql);
    $statement->bindParam(':place_id', $place_id, PDO::PARAM_INT);
    $statement->bindParam(':address', $address);
    $statement->bindParam(':name', $name);
    $statement->bindParam(':type', $type);
    $statement->bindParam(':lat', $lat);
    $statement->bindParam(':long', $long);
    $statement->execute();
    return true;
}

function updatePlace($conn, $place_id, $description, $price, $facebook, $website, $facebook_id) {
    $sql = "UPDATE places
            SET description = :description
            , price = :price
            , facebook = :facebook
            , facebook_id = :facebook_id
            , website = :website
            WHERE place_id = :place_id";

    $statement=$conn->prepare($sql);
    $statement->bindParam(':place_id', $place_id, PDO::PARAM_INT);
    $statement->bindParam(':description', $description);
    $statement->bindParam(':price', $price);
    $statement->bindParam(':facebook', $facebook);
    $statement->bindParam(':facebook_id', $facebook_id);
    $statement->bindParam(':website', $website);
    $statement->execute();
}

function updateStatus($conn, $place_id, $status, $lastreport) {
    $sql = "UPDATE places 
            SET `status` = :status ,
             lastreport = :lastreport
            WHERE place_id = :place_id";

    $statement=$conn->prepare($sql);
    $statement->bindParam(':place_id', $place_id, PDO::PARAM_INT);
    $statement->bindParam(':status', $status);
    $statement->bindParam(':lastreport', $lastreport);
    $statement->execute();
}

function getLastReports($conn, $place_id) {
    $sql = 'SELECT * FROM reports
            WHERE `time` > SUBDATE(NOW(), INTERVAL 180 MINUTE)
            AND `place_id` = :place_id
            ORDER BY id DESC 
            LIMIT 10';
    $statement=$conn->prepare($sql);
    $statement->bindParam(':place_id', $place_id, PDO::PARAM_INT);
    $statement->execute();
    $results=$statement->fetchAll(PDO::FETCH_ASSOC);
    $json=json_encode($results);
    echo($json);
}

function insertReport($conn, $place_id, $status) {
    $sql = "INSERT  INTO `reports` SET  
            `place_id` = :place_id,
            `status` = :status,
            `time` = :time";

    $statement=$conn->prepare($sql);
    $statement->bindParam(':place_id', $place_id, PDO::PARAM_INT);
    $statement->bindParam(':status', $status);
    $statement->bindParam(':time', date('Y-m-d H:i:s'));
    $statement->execute();
}

function placeExists($conn, $place_id){
    $sql = 'SELECT * FROM places WHERE place_id = :place_id';
    $statement=$conn->prepare($sql);
    $statement->bindParam(':place_id', $place_id, PDO::PARAM_INT);
    $statement->execute();
    $results=$statement->fetchAll(PDO::FETCH_ASSOC);
    if(count($results) > 0)
        return true;
    else
        return false;
}


try {
    $conn = new PDO("mysql:host=$servername;dbname=$db", $username, $password);
    // set the PDO error mode to exception
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $query = $_GET['query'];

    if($query == 'getPlaceByPlaceId'){
        $place_id = $_GET['place_id'];
        getPlaceByPlaceId($conn, $place_id);
    }

    if($query == 'insertPlaceIfNotExists'){
        $place_id = $_GET['place_id'];
        $address = $_GET['address'];
        $name = $_GET['name'];
        $type = $_GET['type'];
        $lat = $_GET['lat'];
        $long = $_GET['long'];
        insertIfNotExists($conn, $place_id, $address, $name, $type, $lat, $long);
    }
}
catch(PDOException $e)
{
    echo "Connection failed: " . $e->getMessage();
}
?>