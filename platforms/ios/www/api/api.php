<?php

require_once("Rest.inc.php");

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type,x-prototype-version,x-requested-with');


header( "Content-type: application/json" );

class API extends REST {

    public $data = "";
    //Enter details of your database
    const DB_SERVER = "tafervendo.mysql.uhserver.com";
    const DB_USER = "giabeni";
    const DB_PASSWORD = "25G08i98o@";
    const DB = "tafervendo";

    private $db = NULL;

    public function __construct(){
        parent::__construct();              // Init parent contructor
        $this->dbConnect();                 // Initiate Database connection
    }

    private function dbConnect(){

        $this->db = new PDO("mysql:host=".self::DB_SERVER.";dbname=".self::DB, self::DB_USER, self::DB_PASSWORD);
        if($this->db)
            $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    /*
     * Public method for access api.
     * This method dynmically call the method based on the query string
     *
     */
    public function processApi(){
        //CHECK IF rquest is right
        $func = strtolower(trim(str_replace("/","",$_REQUEST['rquest'])));
        if((int)method_exists($this,$func) > 0)
            $this->$func();
        else
            $this->response('Error code 404, Page not found',404);   // If the method not exist with in this class, response would be "Page not found".
    }
    private function hello(){
        echo str_replace("this","that","HELLO WORLD!!");

    }


    private function test(){
        // Cross validation if the request method is GET else it will return "Not Acceptable" status
        if($this->get_request_method() != "GET"){
            $this->response('',406);
        }
        $conn= $this->db;// variable to access your database
        $place_id=$this->_request['placeId'];

        $sql = 'SELECT * FROM places WHERE place_id = :place_id';
        $statement=$conn->prepare($sql);
        $statement->bindParam(':place_id', $place_id, PDO::PARAM_INT);
        $statement->execute();
        $results=$statement->fetchAll(PDO::FETCH_ASSOC);
        $results = $this->json($results);
        // If success everythig is good send header as "OK" return param
        $this->response($results, 200);
    }


    /*
     *  Encode array into JSON
    */
    private function json($data){
        if(is_array($data)){
            return json_encode($data);
        }
    }
}

// Initiiate Library

$api = new API;
$api->processApi();
?>