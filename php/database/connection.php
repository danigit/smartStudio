<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 17.16
 */

require_once 'config.php';
require_once 'helper.php';
require_once 'db_errors.php';

class Connection{

    private $connection, $query, $result;

    /**
     * Constructor that creates a new connection to the database
     */
    public function __construct(){
        $this->connection = new mysqli(PATH, USERNAME, PASSWORD, DATABASE);

        if (!$this->connection)
            echo 'Connessine non riuscita';
    }

    /**
     * Desctructor that close the existing connection to the database
     */
    function __destruct(){
        $this->connection->close();
    }

    /**
     * Function that insert a new user in USERS table
     * @param $username - the email of the user
     * @param $password - the password of the user
     * @return db_errors|mixed - the id fo
     */
    function register($username, $password){
        $hash_code = password_hash($password, PASSWORD_BCRYPT);

        $this->query = 'INSERT INTO user (USERNAME, PASSWORD, EMAIL,  NAME, ROLE) VALUES (?, ?, ?, ?, ?)';

        $this->result = $this->execute_inserting($this->query, 'ssssi', $username, $hash_code, 'dani@gmail.com', 'dani', 1);

        if ($this->result instanceof db_errors)
            return $this->result;
        elseif ($this->result == false)
            return new db_errors(db_errors::$ERROR_ON_REGISTER_USER);

        return $this->connection->insert_id;
    }

    /**
     * Function that controls the user email and user password passed as parameter are in database
     * @param $username - user email
     * @param $password - user password
     * @return db_errors|array - the user id on success or an error on fail
     */
    function login($username, $password){
        $this->query = 'SELECT ID, PASSWORD, ROLE FROM user WHERE  USERNAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $username);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_LOGIN);

        $statement->bind_result($res_id, $res_pass, $res_role);
        $fetch = $statement->fetch();

        if ($fetch && password_verify($password, $res_pass))
            return array('id' => $res_id, 'role' => $res_role);

        return new db_errors(db_errors::$ERROR_ON_LOGIN);
    }

    /**
     * Function that control if the email passed as parameter exist in user table and insert the email and code in recover_password table
     * @param $email - the email to be controlled
     * @param $code - the code to be inserted
     * @return array|db_errors
     */
    function control_email($email, $code){
        $this->connection->autocommit(false);
        $errors = array();

        $this->query = 'SELECT ID  FROM user WHERE  EMAIL = ?';
        $statement = $this->execute_selecting($this->query, 's', $email);

        if ($statement instanceof db_errors)
            array_push($errors, 'db_error');
        else if ($statement == false)
            array_push($errors, 'false');

        $statement->bind_result($res_id);
        $fetch = $statement->fetch();

        if ($fetch)
            $this->result = array('result' => $res_id);

        $statement->close();

        $this->query = 'INSERT INTO recover_password (EMAIL, CODE) VALUES (?, ?)';
        $result = $this->execute_inserting($this->query, 'ss', $email, $code);

        if ($result instanceof db_errors)
            array_push($errors, 'db_error');
        else if ($result == false)
            array_push($errors, 'false');


        if(!empty($errors)){
            $this->connection->rollback();
            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
        }

        $this->connection->commit();

        return $this->result;
    }

    /**
     * Function thar change the password of the user passed as parameter with the password passed as parameter also
     * @param $code - code that verifies the user
     * @param $username - user to be updated
     * @param $password - new password to be setted
     * @return db_errors|int
     */
    function reset_password($code, $username, $password){
        $hash_password = password_hash($password, PASSWORD_BCRYPT);
        $email = '';
        $this->connection->autocommit(false);
        $errors = array();

        $this->query = 'SELECT EMAIL FROM recover_password WHERE  CODE = ?';
        $statement = $this->execute_selecting($this->query, 's', strtoupper($code));

        if ($statement instanceof db_errors)
            $errors['db'] = 'db_error';
        else if ($statement == false)
            $errors['statement'] = 'statement false';

        $statement->bind_result($res_email);
        $fetch = $statement->fetch();

        if ($fetch) {
            $email = $res_email;
        }else{
            $errors['fetch'] = 'wrong_code';
        }

        $statement->close();

        $this->query = "UPDATE user SET PASSWORD = ? WHERE EMAIL = ? AND USERNAME = ?";
        $statement = $this->execute_selecting($this->query, 'sss', $hash_password, $email, $username);

        if ($statement instanceof db_errors)
            array_push($errors, 'db_error');
        else if ($statement == false)
            array_push($errors, 'false');

        $this->result =  $this->connection->affected_rows;

        if ($this->result == '0'){
            $errors['update'] = 'username';
        }

        if(!empty($errors)){
            $this->connection->rollback();
            if ($errors['fetch'])
                return new db_errors(db_errors::$ERROR_CODE_NOT_FOUND);
            else if ($errors['update'])
                return new db_errors(db_errors::$ERROR_USER_NOT_FOUND);

            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
        }

        $this->query = 'TRUNCATE recover_password';
        $this->connection->query($this->query);


        $this->connection->commit();

        return $this->result;
    }

    function change_password($old_password, $new_password){
        if(!isset($_SESSION))
            session_start();

        $username = $_SESSION['username'];

        $this->query = 'SELECT PASSWORD FROM user WHERE USERNAME = ?';
        $statement = $this->execute_selecting($this->query, 's', $username);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);

        $statement->bind_result($res_pass);
        $fetch = $statement->fetch();

        if (!($fetch && password_verify($old_password, $res_pass)))
            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD_WRONG_OLD);

        $statement->close();

        $hash_code = password_hash($new_password, PASSWORD_BCRYPT);

        $this->query = "UPDATE user SET PASSWORD = ? WHERE USERNAME = ?";

        $statement = $this->execute_selecting($this->query, 'ss', $hash_code, $username);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);

        return $this->connection->affected_rows;
    }
    /**
     * Function tha retrieve the markers from the database
     * @param $username
     * @return array|bool|db_errors|mysqli_result
     */
    function get_markers($username){
        $this->query = 'SELECT location.NAME, LATITUDE, LONGITUDE, ICON FROM location 
                  JOIN user_has_location uhl ON location.ID = uhl.LOCATION_ID 
                  JOIN user u on uhl.USER_ID = u.ID WHERE USERNAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $username);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_MARKERS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $position = array();
            $position[] = $row['LATITUDE'];
            $position[] = $row['LONGITUDE'];

            $result_array[] = array('name' => $row['NAME'], 'position' => $position, "icon" => $row['ICON']);
        }

        return $result_array;
    }

    function insert_location($user, $name, $description, $latitude, $longitude, $image_name){
        $this->connection->autocommit(false);
        $errors = array();

        $this->query = "INSERT INTO location (NAME, DESCRIPTION, LATITUDE, LONGITUDE, ICON) VALUES (?, ?, ?, ?, ?)";
        $statement = $this->execute_inserting($this->query, 'sssss', $name, $description, $latitude, $longitude, $image_name);

        if ($statement instanceof db_errors)
            array_push($errors, 'location_db_error');
        else if ($statement == false)
            array_push($errors,'location_error');

        $this->result =  $this->connection->insert_id;

        $this->query = 'INSERT INTO user_has_location (USER_ID, LOCATION_ID) VALUES (?, ?)';
        $statement = $this->execute_inserting($this->query, 'ii', $user, $this->result);

        if ($statement instanceof db_errors)
            array_push($errors, 'user_location_db_error');
        else if ($statement == false)
            array_push($errors, 'user_location_error');

        $this->connection->commit();

        if (!empty($errors)){
            $this->connection->rollback();
        }

        return $this->result;
    }

    function get_history($fromDate, $toDate, $tag, $event){

        $statement = null;

        if ($tag == null && $event == null) {
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, floor.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS FROM history 
                            JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID JOIN tag ON history.TAG_ID = tag.ID JOIN location l on tag.LOCATION_ID = l.ID
                            JOIN floor ON l.ID = floor.LOCATION_ID WHERE history.TIME BETWEEN ? AND ?";
            $statement = $this->execute_selecting($this->query, 'ss', $fromDate, $toDate);
        } else if ($event == null && $tag != null) {
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, floor.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS FROM history 
                            JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID JOIN tag ON history.TAG_ID = tag.ID JOIN location l on tag.LOCATION_ID = l.ID
                            JOIN floor ON l.ID = floor.LOCATION_ID WHERE tag.NAME = ? AND history.TIME BETWEEN ? AND ?";
            $statement = $this->execute_selecting($this->query, 'sss', $tag, $fromDate, $toDate);
        } else if ($event != null && $tag == null){
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, floor.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS FROM history 
                            JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID JOIN tag ON history.TAG_ID = tag.ID JOIN location l on tag.LOCATION_ID = l.ID
                            JOIN floor ON l.ID = floor.LOCATION_ID WHERE event.DESCRIPTION = ? AND history.TIME BETWEEN ? AND ?";
            $statement = $this->execute_selecting($this->query, 'sss', $event, $fromDate, $toDate);
        } else if ($event != null && $tag != null){
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, floor.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS FROM history 
                            JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID JOIN tag ON history.TAG_ID = tag.ID JOIN location l on tag.LOCATION_ID = l.ID
                            JOIN floor ON l.ID = floor.LOCATION_ID WHERE event.DESCRIPTION = ? AND tag.NAME = ? AND history.TIME BETWEEN ? AND ?";
            $statement = $this->execute_selecting($this->query, 'ssss', $event, $tag, $fromDate, $toDate);
        }

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_MARKERS);

        $this->result = $statement->get_result();

        $array_result = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => $row['ANCHOR_NAME'], 'tag' => $row['TAG_NAME'],
                                    'location' => $row['LOCATION_NAME'], 'floor' => $row['FLOOR_NAME'], 'tag_x_pos' => $row['TAG_X_POS'],
                                    'tag_y_pos' => $row['TAG_Y_POS']);
        }

        return $array_result;
//        $statement = $this->execute_selecting($this->query, 's', $username);

//        if ($statement instanceof db_errors)
//            return $statement;
//        else if ($statement == false)
//            return new db_errors(db_errors::$ERROR_ON_GETTING_MARKERS);
//
//        $this->result = $statement->get_result();
//        $result_array = array();
//
//        while ($row = mysqli_fetch_assoc($this->result)) {
//            $position = array();
//            $position[] = $row['latitude'];
//            $position[] = $row['longitude'];
//
//            $result_array[] = array('name' => $row['name'], 'position' => $position, "icon" => $row['icon']);
//        }

//        return $result_array;
    }

    /**
     * Function that retrieve the image of the floor passed as the parameter on the location passed as parameter
     * @param $location - the location where the floor is
     * @param $floor - the floor for witch to retrieve the map
     * @return db_errors|array
     */
    function get_floor_info($location, $floor){
        $this->query = 'SELECT floor.ID, floor.NAME, floor.MAP_WIDTH, floor.MAP_SPACING FROM floor JOIN location ON floor.LOCATION_ID = location.ID WHERE location.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'width' => $row['MAP_WIDTH'], 'spacing' => $row['MAP_SPACING']);
        }

        return $result_array;
    }

    function get_anchors_by_floor($floor){
        $this->query = 'SELECT anchor.ID, anchor.NAME, X_POS, Y_POS, Z_POS, RADIUS, IP, RSSI_THRESHOLD, PROXIMITY, TYPE, PERMITTED_ASSET FROM anchor JOIN floor ON anchor.FLOOR_ID = floor.ID
                        WHERE floor.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $floor);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'],
                'z_pos' => $row['Z_POS'], 'radius' => $row['RADIUS'], 'ip' => $row['IP'], 'rssi' => $row['RSSI_THRESHOLD'], 'proximity' => $row['PROXIMITY'],
                'type' => $row['TYPE'], 'permitted_asset' => $row['PERMITTED_ASSET']);
        }

        return $result_array;
    }

    function get_anchors_by_location($location){
        $this->query = 'SELECT anchor.ID, anchor.NAME, X_POS, Y_POS, Z_POS, anchor.RADIUS, IP, RSSI_THRESHOLD, PROXIMITY, TYPE, PERMITTED_ASSET FROM anchor JOIN floor ON anchor.FLOOR_ID = floor.ID
                        JOIN location l on floor.LOCATION_ID = l.ID WHERE l.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'],
                'z_pos' => $row['Z_POS'], 'radius' => $row['RADIUS'], 'ip' => $row['IP'], 'rssi' => $row['RSSI_THRESHOLD'], 'proximity' => $row['PROXIMITY'],
                'type' => $row['TYPE'], 'permitted_asset' => $row['PERMITTED_ASSET']);
        }

        return $result_array;
    }

    function get_cameras($floor){
        $this->query = 'SELECT camera.ID, DESCRIPTION, USERNAME, PASSWORD, X_POS, Y_POS, RADIUS FROM camera 
                        JOIN floor ON FLOOR_ID = floor.ID WHERE floor.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $floor);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'description' => $row['DESCRIPTION'], 'username' => $row['USERNAME'],
                'password' => $row['PASSWORD'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'], 'radius' => $row['RADIUS']);
        }

        return $result_array;
    }

//    function get_tags_by_location($location){
//
//        $this->query = 'SELECT tag.id, tag.name FROM tag JOIN anchor ON tag.anchor_id = anchor.id
//                        JOIN floor ON anchor.floor_id = floor.id JOIN location ON floor.location_id = location.id WHERE location.name = ?';
//
//        $statement = $this->execute_selecting($this->query, 's', $location);
//
//        if ($statement instanceof db_errors)
//            return $statement;
//        else if ($statement == false)
//            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
//
//        $this->result = $statement->get_result();
//        $result_array = array();
//
//        while ($row = mysqli_fetch_assoc($this->result)) {
//            $result_array[] = array('id' => $row['id'], 'name' => $row['name']);
//        }
//
//        return $result_array;
//    }

    function get_tags_by_user($user){

        $this->query = 'SELECT t.ID, t.NAME FROM user JOIN user_has_location uhl ON user.ID = uhl.USER_ID
                        JOIN location l ON uhl.LOCATION_ID = l.ID JOIN floor ON l.ID = floor.LOCATION_ID JOIN anchor ON floor.ID = anchor.FLOOR_ID
                        JOIN tag t on anchor.ID = t.ANCHOR_ID WHERE user.USERNAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $user);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME']);
        }

        return $result_array;
    }

    function get_tags_by_floor($floor){

        $this->query = 'SELECT tag.ID, tag.NAME, tag.X_POS, tag.Y_POS FROM tag JOIN anchor a ON tag.ANCHOR_ID = a.ID JOIN floor ON a.FLOOR_ID = floor.ID WHERE floor.ID = ?';

        $statement = $this->execute_selecting($this->query, 's', $floor);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], 'y_pos' => $row['Y_POS']);
        }

        return $result_array;
    }

    function get_tags_by_location($location){

        $this->query = 'SELECT tag.ID, tag.NAME FROM tag JOIN location l ON tag.LOCATION_ID = l.ID WHERE l.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME']);
        }

        return $result_array;
    }

    function get_events(){
        $this->query = 'SELECT ID, DESCRIPTION, ICON_NAME FROM event';

        $this->result = $this->connection->query($this->query);

        if ($this->result == false)
            return new db_errors(db_errors::$ERROR_ON_TEST);

        $array_result = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $array_result[] = array('id' => $row['ID'], 'description' => $row['DESCRIPTION'], 'icon_name' => $row['ICON_NAME']);
        }

        return $array_result;
    }

    function get_floors($location){
        $this->query = 'SELECT floor.ID, floor.NAME, floor.IMAGE_MAP, floor.MAP_WIDTH, floor.MAP_SPACING FROM floor JOIN location ON floor.LOCATION_ID = location.ID WHERE location.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'image_map' => $row['IMAGE_MAP'], 'width' => $row['MAP_WIDTH'], 'map_spacing' => $row['MAP_SPACING']);
        }

        return $result_array;
    }

    function change_tag_field($tag_id, $tag_field, $field_value){

        $this->query = "UPDATE tag SET " . strtoupper($tag_field) . " = ? WHERE ID = ?";
        $statement = $this->execute_selecting($this->query, 'ss', $field_value, $tag_id);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_UPDATING_TAG);

        $this->result =  $this->connection->affected_rows;

        return $this->result;
    }

    function change_anchor_field($anchor_id, $anchor_field, $field_value){
        $this->query = "UPDATE anchor SET " . strtoupper($anchor_field) . " = ? WHERE ID = ?";
        $statement = $this->execute_selecting($this->query, 'si', $field_value, $anchor_id);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_UPDATING_TAG);

        $this->result =  $this->connection->affected_rows;

        return $this->result;
    }

    function change_floor_field($floor_id, $floor_field, $field_value){
        $this->query = "UPDATE floor SET " . strtoupper($floor_field) . " = ? WHERE ID = ?";
        $statement = $this->execute_selecting($this->query, 'si', $field_value, $floor_id);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_UPDATING_TAG);

        $this->result =  $this->connection->affected_rows;

        return $this->result;
    }

    /**
     * Function that uses the execute statement to execute a query with the prepare statement
     * @param $query - the query to be executed
     * @param $bind_string - the string containing the types of the parameters of the query
     * @param mixed ...$params - the parameters of the query
     * @return bool|db_errors - the result of the query
     */
    function execute_inserting($query, $bind_string, ...$params){
        $statement = $this->connection->prepare($query);
        $bind_names[] = $bind_string;

        for ($i = 0; $i < count($params); $i++){
            $bind_name = 'bind' . $i;
            $$bind_name = $params[$i];
            $bind_names[] = &$$bind_name;
        }

        call_user_func_array(array($statement, 'bind_param'), $bind_names);

        try{
            $result = $statement->execute();
            if ($result == false)
                return parse_errors($statement->error_list[0]);
        }catch (Exception $e){
            return new db_errors(db_errors::$ERROR_ON_EXECUTE);
        }

        $statement->close();
        return $result;
    }

    /**
     * Function that uses the execute statement to execute a query with the prepare statement
     * @param $query - the query to be executed
     * @param $bind_string - the string containing the types of the parameters of the query
     * @param mixed ...$params - the parameters of the query
     * @return mysqli_stmt|db_errors
     */
    function execute_selecting($query, $bind_string, ...$params){
        $statement = $this->connection->prepare($query);
        $bind_names[] = $bind_string;

        for ($i = 0; $i < count($params); $i++){
            $bind_name = 'bind' . $i;
            $$bind_name = $params[$i];
            $bind_names[] = &$$bind_name;
        }

        call_user_func_array(array($statement, 'bind_param'), $bind_names);

        try{
            $statement->execute();
        }catch (Exception $e){
            return new db_errors(db_errors::$ERROR_ON_EXECUTE);
        }

        return $statement;
    }
}

//$conn = new Connection();
//$conn->register('dani', 'dani');