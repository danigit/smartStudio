<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 17.16
 */

require_once 'dani_config.php';
require_once 'helper.php';
require_once 'db_errors.php';

class Connection
{

    private $connection, $query, $result;

    /**
     * Constructor that creates a new connection to the database
     */
    public function __construct()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if (!$this->connection)
            echo 'Connessine non riuscita';
    }

    /**
     * Desctructor that close the existing connection to the database
     */
    function __destruct()
    {
        $this->connection->close();
    }

    /**
     * Function that insert a new user in USERS table
     * @param $username - the email of the user
     * @param $password - the password of the user
     * @return db_errors|mixed - the id fo
     */
    function register($username, $password)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $hash_code = password_hash($password, PASSWORD_BCRYPT);

            $this->query = 'INSERT INTO user (USERNAME, PASSWORD, EMAIL,  NAME, ROLE) VALUES (?, ?, ?, ?, ?)';

            $this->result = $this->execute_inserting($this->query, 'ssssi', $username, $hash_code, 'dani@gmail.com', 'dani', 1);

            if ($this->result instanceof db_errors)
                return $this->result;
            elseif ($this->result == false)
                return new db_errors(db_errors::$ERROR_ON_REGISTER_USER);

            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that controls the user email and user password passed as parameter are in database
     * @param $username - user email
     * @param $password - user password
     * @return db_errors|array - the user id on success or an error on fail
     */
    function login($username, $password)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ID, PASSWORD, ROLE FROM user WHERE  USERNAME = ?';

            $statement = $this->execute_selecting($this->query, 's', $username);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_LOGIN);
            }

            $statement->bind_result($res_id, $res_pass, $res_role);
            $fetch = $statement->fetch();

            mysqli_close($this->connection);

            if ($fetch && password_verify($password, $res_pass))
                return array('id' => $res_id, 'role' => $res_role);

            return new db_errors(db_errors::$ERROR_ON_LOGIN);
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that control if the email passed as parameter exist in user table and insert the email and code in recover_password table
     * @param $email - the email to be controlled
     * @param $code - the code to be inserted
     * @return array|db_errors
     */
    function control_email($email, $code)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);
        if ($this->connection) {
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


            if (!empty($errors)) {
                $this->connection->rollback();
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function thar change the password of the user passed as parameter with the password passed as parameter also
     * @param $code - code that verifies the user
     * @param $username - user to be updated
     * @param $password - new password to be setted
     * @return db_errors|int
     */
    function reset_password($code, $username, $password)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
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
            } else {
                $errors['fetch'] = 'wrong_code';
            }

            $statement->close();

            $this->query = "UPDATE user SET PASSWORD = ? WHERE EMAIL = ? AND USERNAME = ?";
            $statement = $this->execute_selecting($this->query, 'sss', $hash_password, $email, $username);

            if ($statement instanceof db_errors)
                array_push($errors, 'db_error');
            else if ($statement == false)
                array_push($errors, 'false');

            $this->result = $this->connection->affected_rows;

            if ($this->result == '0') {
                $errors['update'] = 'username';
            }

            if (!empty($errors)) {
                $this->connection->rollback();
                mysqli_close($this->connection);
                if ($errors['fetch'])
                    return new db_errors(db_errors::$ERROR_CODE_NOT_FOUND);
                else if ($errors['update'])
                    return new db_errors(db_errors::$ERROR_USER_NOT_FOUND);

                return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
            }

            $this->query = 'TRUNCATE recover_password';
            $this->connection->query($this->query);


            $this->connection->commit();

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that changes the password
     * @param $old_password
     * @param $new_password
     * @return db_errors|int|mysqli_stmt
     */
    function change_password($old_password, $new_password, $username)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            if (!isset($_SESSION))
                session_start();

//            $username = $_SESSION['username_' . $user_name];

            $this->query = 'SELECT PASSWORD FROM user WHERE USERNAME = ?';
            $statement = $this->execute_selecting($this->query, 's', $username);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
            }

            $statement->bind_result($res_pass);
            $fetch = $statement->fetch();

            if (!($fetch && password_verify($old_password, $res_pass))) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD_WRONG_OLD);
            }

            $statement->close();

            $hash_code = password_hash($new_password, PASSWORD_BCRYPT);

            $this->query = "UPDATE user SET PASSWORD = ?, PASSWORD_CHANGED = ? WHERE USERNAME = ?";

            $statement = $this->execute_selecting($this->query, 'sis', $hash_code, 1, $username);

            if ($statement instanceof db_errors)
                return $statement;
            else if ($statement == false)
                return new db_errors(db_errors::$ERROR_ON_UPDATING_PASSWORD);

            $aff_rows = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function tha retrieve the markers from the database
     * @param $username
     * @return array|bool|db_errors|mysqli_result
     */
    function get_markers($username)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT location.NAME, LATITUDE, LONGITUDE, RADIUS, ICON, IS_INSIDE, ONE_LOCATION FROM location 
                  JOIN user_has_location uhl ON location.ID = uhl.LOCATION_ID 
                  JOIN user u on uhl.USER_ID = u.ID WHERE USERNAME = ?';

            $statement = $this->execute_selecting($this->query, 's', $username);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_MARKERS);
            }

            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $position = array();
                $position[] = $row['LATITUDE'];
                $position[] = $row['LONGITUDE'];

                $result_array[] = array('name' => $row['NAME'], 'position' => $position, 'radius' => $row['RADIUS'],
                    "icon" => $row['ICON'], 'is_inside' => $row['IS_INSIDE'], 'one_location' => $row['ONE_LOCATION']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that deletes a marker from database
     * @param $mac
     * @return db_errors|int|mysqli_stmt
     */
    function delete_mac($mac)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM tag_mac WHERE ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $mac);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_MAC);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that deletes a marker from database
     * @param $category
     * @return db_errors|int|mysqli_stmt
     */
    function delete_tag_category($category)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM category WHERE ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $category);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_MAC);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that deletes a marker from database
     * @param $safety_box
     * @return db_errors|int|mysqli_stmt
     */
    function delete_safety_box($safety_box)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM safety_box WHERE ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $safety_box);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_MAC);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that deletes a marker from database
     * @param $tags_categories
     * @return db_errors|array|mysqli_stmt
     */
    function update_tag_category($tags_categories)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $decoded = $tags_categories;
            $this->connection->autocommit(false);
            $errors = array();

            $this->query = 'UPDATE tag SET CATEGORY_ID = NULL';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                array_push($errors, 'error_on_setting_null');
            }

            foreach ($decoded as $category){
                $cat = (array) $category;
                foreach ($cat['tags'] as $tag){
                    $this->query = 'UPDATE tag SET CATEGORY_ID = ? WHERE ID = ?';

                    $statement = $this->execute_selecting($this->query, 'ii', $cat['category'], $tag);

                    if ($statement instanceof db_errors) {
                        array_push($errors, 'db_error_on_updating_categories');
                    } else if ($statement == false) {
                        array_push($errors, 'error_on_updating_categories');
                    }
                }
            }

            if (!empty($errors)) {
                $this->connection->rollback();
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $errors;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }


    /**
     * Funzione che cancella un'ancora
     * @param $anchor
     * @return db_errors|int|mysqli_stmt
     */
    function delete_anchor($anchor)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM anchor WHERE ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $anchor);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_ANCHOR);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che cancella un piano
     * @param $floor_id
     * @return db_errors|int|mysqli_stmt
     */
    function delete_floor($floor_id)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM floor WHERE floor.ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $floor_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_FLOOR);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che cancella un tag
     * @param $tag
     * @return array|db_errors
     */
    function delete_tag($tag)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection->autocommit(false);
            $errors = array();

            $this->query = 'DELETE FROM dress_alarm WHERE TAG_ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $tag);

            if ($statement instanceof db_errors) {
                $errors['db_error'] = 1;
            } else if ($statement == false) {
                $errors['return_false'] = 1;
            }

            $statement->close();

            $this->query = 'DELETE FROM tag_mac WHERE TAG_ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $tag);

            if ($statement instanceof db_errors) {
                $errors['db_error'] = 1;
            } else if ($statement == false) {
                $errors['return_false'] = 1;
            }
            $statement->close();

            $this->query = 'DELETE FROM tag_rangings WHERE TAG_ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $tag);

            if ($statement instanceof db_errors)
                $errors['db_error'] = 1;
            else if ($statement == false)
                $errors['return_false'] = 1;

            $statement->close();

            $this->query = 'DELETE FROM wetag_settings WHERE TAG_ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $tag);

            if ($statement instanceof db_errors)
                $errors['db_error'] = 1;
            else if ($statement == false)
                $errors['return_false'] = 1;

            $statement->close();

            $this->query = 'DELETE FROM tag WHERE ID = ?';
            $statement = $this->execute_selecting($this->query, 'i', $tag);

            if ($statement instanceof db_errors)
                $errors['db_error'] = 1;
            else if ($statement == false)
                $errors['return_false'] = 1;

            $statement->close();

            if (!empty($errors)) {
                $this->connection->rollback();
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $errors;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che cancella una location
     * @param $location
     * @return array|db_errors
     */
    function delete_location($location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection->autocommit(false);
            $errors = array();

            $this->query = 'DELETE FROM location WHERE ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $location);

            if ($statement instanceof db_errors)
                $errors['db_error'] = 1;
            else if ($statement == false)
                $errors['return_false'] = 1;

            $statement->close();

            $this->query = 'DELETE FROM user_has_location WHERE LOCATION_ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $location);

            if ($statement instanceof db_errors)
                $errors['db_error'] = 1;
            else if ($statement == false)
                $errors['return_false'] = 1;

            if (!empty($errors)) {
                $this->connection->rollback();
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $errors;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che recupera tutti i tipi di un tag
     * @return array|db_errors
     */
    function get_all_types()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ID, DESCRIPTION FROM tag_types';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_MAC_TYPES);
            }

            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'description' => $row['DESCRIPTION']);
            }

            mysqli_close($this->connection);

            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che recupera tutti i tag di un mac
     * @param $tag
     * @return array|db_errors|mysqli_stmt
     */
    function get_tag_macs($tag)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ID, MAC, TYPE FROM tag_mac WHERE TAG_ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $tag);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_TAG_MACS);
            }

            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'mac' => $row['MAC'], 'type' => $row['TYPE']);
            }

            mysqli_close($this->connection);

            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_tag_parameters($tag)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ADV_RATE, POWER_LEVEL, DISABLE_TIMING, ALARM_TIMING, NO_MOV_TIMING, MD_MODE, MAC_FILTER, PERIODIC_SOUND,
                                   KA, SCANNING_RATE, LND_PRT_TIMING, SCANNING_PKT, FREEFALL_THD, SIM_IS_HERE, WIFI_IS_HERE, PERIODIC_SOUND
                                   ADVERTISE_IS_HERE, REST_NAME, SERVER_IP, SSID_WIFI, PWD_WIFI, IP_GATEWAY_WIFI, IP_WETAG_WIFI, APN_NAME, APN_CODE, 
                                   MAC_UWB, UDP_PORT_UWB, GEOFENCE_THD, TACITATION_MODE, LND_PRT_ANGLE FROM wetag_settings WHERE TAG_ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $tag);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_TAG_MACS);
            }

            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('adv_rate' => $row['ADV_RATE'], 'power_level' => $row['POWER_LEVEL'], 'disable_timing' => $row['DISABLE_TIMING'], 'alarm_timing' => $row['ALARM_TIMING'], 'no_mov_timing' => $row['NO_MOV_TIMING'], 'md_mode' => $row['MD_MODE'],
                    'mac_filter' => $row['MAC_FILTER'], 'periodic_sound' => $row['PERIODIC_SOUND'], 'ka' => $row['KA'], 'scanning_rate' => $row['SCANNING_RATE'], 'lnd_prt_timing' => $row['LND_PRT_TIMING'], 'scanning_pkt' => $row['SCANNING_PKT'], 'freefall_thd' => $row['FREEFALL_THD'], 'sim_is_here' => $row['SIM_IS_HERE'],
                    'wifi_is_here' => $row['WIFI_IS_HERE'], 'advertise_is_here' => $row['ADVERTISE_IS_HERE'], 'rest_name' => $row['REST_NAME'], 'server_ip' => $row['SERVER_IP'], 'ssid_wifi' => $row['SSID_WIFI'], 'pwd_wifi' => $row['PWD_WIFI'],
                    'ip_gateway_wifi' => $row['IP_GATEWAY_WIFI'], 'ip_wetag_wifi' => $row['IP_WETAG_WIFI'], 'apn_name' => $row['APN_NAME'], 'apn_code' => $row['APN_CODE'], 'mac_uwb' => $row['MAC_UWB'], 'udp_port_uwb' => $row['UDP_PORT_UWB'], 'geofence_thd' => $row['GEOFENCE_THD'], 'tacitation_mode' => $row['TACITATION_MODE'],
                    'lnd_prt_angle' => $row['LND_PRT_ANGLE']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che recupera tutti i tag di un mac
     * @param $tag
     * @return array|db_errors|mysqli_stmt
     */
    function get_all_tags_macs()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT tag_mac.ID, MAC, tag_mac.TYPE, NAME FROM tag_mac JOIN tag ON tag.ID = TAG_ID';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_MAC_TYPES);
            }

            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'mac' => $row['MAC'], 'type' => $row['TYPE'],
                    'tag_name' => $row['NAME']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che inserisce un nuovo mac
     * @param $name
     * @param $type
     * @param $tag_id
     * @return bool|db_errors|mixed
     */
    function insert_mac($name, $type, $tag_id)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "INSERT INTO tag_mac (MAC, TYPE, TAG_ID) VALUES (?, ?, ?)";

            $statement = $this->execute_inserting($this->query, 'sss', $name, $type, $tag_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_INSERTING_MAC);
            }


            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che inserisce un nuovo tag
     * @param $name
     * @param $type
     * @param $macs
     * @return array|db_errors
     */
    function insert_tag($name, $type, $macs)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection->autocommit(false);
            $errors = array();

            $this->query = "SELECT ID FROM tag_types WHERE DESCRIPTION = ?";
            $statement = $this->execute_selecting($this->query, 's', $type);

            if ($statement instanceof db_errors)
                array_push($errors, 'getting_type_id');
            else if ($statement == false)
                array_push($errors, 'getting_type_id');

            $statement->bind_result($res_id);
            $fetch = $statement->fetch();

            $statement->close();

            if ($fetch) {

                $this->query = "INSERT INTO tag (NAME, TYPE, TIME, GPS_TIME, ALARM_TIME) VALUES (?, ?, NOW(), NOW(), NOW())";

                $statement = $this->execute_inserting($this->query, 'ss', $name, $res_id);

                if ($statement instanceof db_errors)
                    array_push($errors, 'insert_tag_execute');
                else if ($statement == false)
                    array_push($errors, 'insert_tag_false');

                $this->result = $this->connection->insert_id;

                if ($type == 1 || $type == 2 || $type == 3 || $type == 4 || $type == 9 || $type == 10 || $type == 11 || $type == 12) {

                    if ($this->result != 0) {
                        $this->query = "INSERT INTO tag_mac (mac, TYPE, tag_id) VALUES (?, ?,  ?)";

                        $statement = $this->execute_inserting($this->query, 'sii', $macs[0], 0, $this->result);

                        if ($statement instanceof db_errors)
                            array_push($errors, 'insert_tag_mac_execute');
                        else if ($statement == false)
                            array_push($errors, 'tag_mac_false');
                    } else {
                        array_push($errors, 'tag_not_inserted');
                    }
                } else if ($type == 5 || $type == 6 || $type == 7 || $type == 8 || $type == 13) {
                    if ($this->result != 0) {
                        for ($i = 0; $i < count($macs); $i++) {
                            if (strlen($macs[$i]) == 12) {
                                $this->query = "INSERT INTO tag_mac (mac, TYPE, tag_id) VALUES (?, ?,  ?)";

                                $statement = $this->execute_inserting($this->query, 'sii', $macs[$i], 0, $this->result);

                                if ($statement instanceof db_errors)
                                    array_push($errors, 'insert_tag_mac_execute');
                                else if ($statement == false)
                                    array_push($errors, 'tag_mac_false');
                            } else if (strlen($macs[$i]) == 4) {
                                $this->query = "INSERT INTO tag_mac (mac, TYPE, tag_id) VALUES (?, ?,  ?)";

                                $statement = $this->execute_inserting($this->query, 'sii', $macs[$i], 1, $this->result);

                                if ($statement instanceof db_errors)
                                    array_push($errors, 'insert_tag_mac_execute');
                                else if ($statement == false)
                                    array_push($errors, 'tag_mac_false');
                            }
                        }
                    } else {
                        array_push($errors, 'tag_not_inserted');
                    }
                } else if ($type == 14 || $type == 15 || $type == 16 || $type == 17) {
                    if ($this->result != 0) {
                        $this->query = "INSERT INTO tag_mac (MAC, TYPE, TAG_ID) VALUES (?, ?,  ?)";

                        $statement = $this->execute_inserting($this->query, 'sii', $macs[0], 1, $this->result);

                        if ($statement instanceof db_errors)
                            array_push($errors, 'insert_tag_mac_execute');
                        else if ($statement == false)
                            array_push($errors, 'tag_mac_false');
                    } else {
                        array_push($errors, 'tag_not_inserted');
                    }
                }

                if ($this->result != 0) {
                    $this->query = "INSERT INTO tag_rangings (TAG_ID) VALUES (?)";

                    $statement = $this->execute_inserting($this->query, 'i', $this->result);

                    if ($statement instanceof db_errors)
                        array_push($errors, 'insert_tag_mac_execute');
                    else if ($statement == false)
                        array_push($errors, 'tag_mac_false');

                    $this->query = "INSERT INTO dress_alarm (TAG_ID) VALUES (?)";

                    $statement = $this->execute_inserting($this->query, 'i', $this->result);

                    if ($statement instanceof db_errors)
                        array_push($errors, 'insert_tag_mac_execute');
                    else if ($statement == false)
                        array_push($errors, 'tag_mac_false');

                    $this->query = "INSERT INTO wetag_settings (TAG_ID, TYPE) VALUES (?, ?)";

                    $statement = $this->execute_inserting($this->query, 'ii', $this->result, $res_id);

                    if ($statement instanceof db_errors)
                        array_push($errors, 'insert_tag_mac_execute');
                    else if ($statement == false)
                        array_push($errors, 'tag_mac_false');
                } else {
                    array_push($errors, 'tag_not_inserted');
                }
            }

            if (!empty($errors)) {
                $this->connection->rollback();
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $errors;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che inserisce una nuova categoria per i tag
     * @param $name
     * @param $alarm_name
     * @param $no_alarm_name
     * @return bool|db_errors|mixed
     */
    function insert_tag_category($name, $alarm_name, $no_alarm_name)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "INSERT INTO category (DESCRIPTION, ICON_NAME_ALARM, ICON_NAME_NO_ALARM) VALUES (?, ?, ?)";

            $statement = $this->execute_inserting($this->query, 'sss', $name, $alarm_name, $no_alarm_name);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_INSERTING_MAC);
            }


            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che inserisce una nuova categoria per i tag
     * @param $name
     * @param $imei
     * @return bool|db_errors|mixed
     */
    function insert_safety_box($name, $imei)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "INSERT INTO safety_box (NAME, IMEI) VALUES (?, ?)";

            $statement = $this->execute_inserting($this->query, 'ss', $name, $imei);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_INSERTING_SAFETY_BOX);
            }


            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }
    /**
     * Funzione che salva un disegno sul canvas
     * @param $lines
     * @param $floor
     * @param $zones
     * @return array | db_errors
     */
    function save_drawing($lines, $floor, $zones)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {

            $this->connection->autocommit(false);
            $errors = array();

            $this->query = "UPDATE floor SET DRAW_POINT = ? WHERE ID = ?";

            $statement = $this->execute_selecting($this->query, 'ss', $lines, $floor);

            if ($statement instanceof db_errors)
                array_push($errors, 'db_error_draw_line');
            else if ($statement == false)
                array_push($errors, 'draw_line_false');

            $statement->close();

            for ($i = 0; $i < count($zones); $i++) {
                $this->query = "INSERT INTO zone (X_LEFT, X_RIGHT, Y_UP, Y_DOWN, FLOOR_ID) VALUES (?, ?, ?, ?, ?)";
                $statement = $this->execute_inserting($this->query, 'ddddi', $zones[$i]['topLeft']['x'], $zones[$i]['bottomRight']['x'],
                    $zones[$i]['topLeft']['y'], $zones[$i]['bottomRight']['y'], $floor);

                if ($statement instanceof db_errors)
                    array_push($errors, 'insert_zone_execute');
                else if ($statement == false)
                    array_push($errors, 'insert_zone_false');
            }

            if (!empty($errors)) {
                $this->connection->rollback();
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $errors;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che recupera un disegno salvato in precedenza
     * @param $floor
     * @return db_errors|mysqli_stmt
     */
    function get_drawing($floor)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {

            $this->query = "SELECT DRAW_POINT FROM floor WHERE ID = ?";

            $statement = $this->execute_selecting($this->query, 's', $floor);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_DRAWING);
            }

            $statement->bind_result($res_draw);
            $fetch = $statement->fetch();

            if ($fetch) {
                mysqli_close($this->connection);
                return $res_draw;
            }

            mysqli_close($this->connection);
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che inserisce un'ancora
     * @param $name
     * @param $mac
     * @param $type
     * @param $ip
     * @param $rssi
     * @param $proximity
     * @param $permitted
     * @param $neighbors
     * @param $floor
     * @return array|db_errors
     */
    function insert_anchor($name, $mac, $type, $ip, $rssi, $proximity, $permitted, $neighbors, $floor)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection->autocommit(false);
            $errors = array();

            $permittedString = '';


            for ($i = 0; $i < count($permitted); $i++) {
                $this->query = 'SELECT MAC FROM tag_mac WHERE TAG_ID = ?';

                $statement = $this->execute_selecting($this->query, 'i', $permitted[$i]);

                if ($statement instanceof db_errors)
                    array_push($errors, 'select_tag_macs_db_error');
                else if ($statement == false)
                    array_push($errors, 'select_tag_macs_false');

                $this->result = $statement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $permittedString .= $row['MAC'] . ',';
                }

                $statement->close();
            }

            if (substr($permittedString, -1, 1) == ',')
                $permittedString = substr($permittedString, 0, -1);


            $this->query = 'SELECT ID FROM anchor_types WHERE DESCRIPTION = ?';
            $statement = $this->execute_selecting($this->query, 's', $type);

            if ($statement instanceof db_errors)
                array_push($errors, 'getting_type_id');
            else if ($statement == false)
                array_push($errors, 'getting_type_id');

            $statement->bind_result($res_id);
            $fetch = $statement->fetch();

            $statement->close();

            if ($fetch) {
                $this->query = 'INSERT INTO anchor (MAC, NAME, TYPE, NEIGHBORS, PROXIMITY, IP, PERMITTED_ASSET, RSSI_THRESHOLD, FLOOR_ID) VALUES (?, ?, ? ,?, ?, ?, ?, ?, ?)';

                $statement = $this->execute_inserting($this->query, 'ssisissii', $mac, $name, $res_id, $neighbors, $proximity, $ip, $permittedString, $rssi, $floor);

                if ($statement instanceof db_errors)
                    array_push($errors, 'insert_anchor_db_error');
                else if ($statement == false)
                    array_push($errors, 'insert_anchor_error');

                $this->result = $this->connection->insert_id;

            }

            if (!empty($errors)) {
                $this->connection->rollback();
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $errors;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that updates anchor position
     * @param $position
     * @param $id
     * @param $floor
     * @return db_errors|array|mysqli_stmt
     */
    function update_anchor_position($position, $id, $floor)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection->autocommit(false);
            $errors = array();

            $this->query = 'SELECT ID FROM floor WHERE NAME = ?';

            $statement = $this->execute_selecting($this->query, 's', $floor);

            if ($statement instanceof db_errors)
                array_push($errors, 'select_anchor_db_error');
            else if ($statement == false)
                array_push($errors, 'select_anchor_false_error');

            $statement->bind_result($res_id);
            $fetch = $statement->fetch();

            if ($fetch) {
                $statement->close();
                for ($i = 0; $i < count($id); $i++) {

                    $this->query = "UPDATE anchor SET X_POS = ?, Y_POS = ?, FLOOR_ID = ?  WHERE ID = ?";

                    $statement = $this->execute_selecting($this->query, 'sssi', $position[$i]['width'], $position[$i]['height'], $res_id, $id[$i]);

                    if ($statement instanceof db_errors)
                        array_push($errors, 'update_anchor_db_error');
                    else if ($statement == false)
                        array_push($errors, 'update_anchor_false_error');

                    $statement->close();

                }
            }
            if (!empty($errors)) {
                $this->connection->rollback();
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $errors;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that inserts a new location
     * @param $user
     * @param $name
     * @param $description
     * @param $latitude
     * @param $longitude
     * @param $image_name
     * @param $radius
     * @param $meter_radius
     * @param $is_indoor
     * @return array|db_errors
     */
    function insert_location($user, $name, $description, $latitude, $longitude, $image_name, $radius, $meter_radius, $is_indoor)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection->autocommit(false);
            $errors = array();
            if ($image_name === '' && $is_indoor === true)
                $image_name = 'location-marker.png';
            else if ($image_name === '')
                $image_name = 'mountain.png';

            $this->query = "INSERT INTO location (NAME, DESCRIPTION, LATITUDE, LONGITUDE, ICON, RADIUS, METER_RADIUS, IS_INSIDE) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            $statement = $this->execute_inserting($this->query, 'sssssddi', $name, $description, $latitude, $longitude, $image_name, $radius, $meter_radius, (int)$is_indoor);

            if ($statement instanceof db_errors)
                array_push($errors, 'location_db_error');
            else if ($statement == false)
                array_push($errors, 'location_error');

            $this->result = $this->connection->insert_id;

            $this->query = 'INSERT INTO user_has_location (USER_ID, LOCATION_ID) VALUES (?, ?)';
            $statement = $this->execute_inserting($this->query, 'ii', $user, $this->result);

            if ($statement instanceof db_errors)
                array_push($errors, 'user_location_db_error');
            else if ($statement == false)
                array_push($errors, 'user_location_error');

            if ($is_indoor) {
                $this->query = "INSERT INTO floor (NAME, IMAGE_MAP, MAP_WIDTH, MAP_SPACING, LOCATION_ID) VALUES ('Piano di default', 'default_floor.png', 30, 10, ?)";

                $statement = $this->execute_inserting($this->query, 'i', $this->result);

                if ($statement instanceof db_errors)
                    array_push($errors, 'insert_floor_db_error');
                else if ($statement == false)
                    array_push($errors, 'insert_floor_error');

            }

            if (!empty($errors)) {
                $this->connection->rollback();
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $errors;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that inserts a new floor
     * @param $name
     * @param $map_image
     * @param $map_width
     * @param $spacing
     * @param $location
     * @return bool|db_errors|mixed
     */
    function insert_floor($name, $map_image, $map_width, $spacing, $location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {

            $this->query = "INSERT INTO floor (NAME, IMAGE_MAP, MAP_WIDTH, MAP_SPACING, LOCATION_ID) VALUES (?, ?, ?, ?, ?)";
            $statement = $this->execute_inserting($this->query, 'ssiii', $name, $map_image, $map_width, $spacing, $location);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_INSERTING_FLOOR);
            }

            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets the location info
     * @param $location
     * @return array|db_errors|mysqli_stmt
     */
    function get_location_info($location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT location.NAME, DESCRIPTION, LATITUDE, LONGITUDE, ICON, RADIUS, METER_RADIUS, IS_INSIDE FROM location WHERE location.NAME = ?';

            $statement = $this->execute_selecting($this->query, 's', $location);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_LOCATION_INFO);
            }

            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {

                $result_array = array('name' => $row['NAME'], 'description' => $row['DESCRIPTION'], 'latitude' => $row['LATITUDE'], 'longitude' => $row['LONGITUDE'],
                    "icon" => $row['ICON'], 'radius' => $row['RADIUS'], 'meter_radius' => $row['METER_RADIUS'], 'is_inside' => $row['IS_INSIDE']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets the location info
     * @param $location
     * @return array|db_errors|mysqli_stmt
     */
    function get_location_tags($location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT t.ID, t.NAME FROM location JOIN floor f on location.ID = f.LOCATION_ID JOIN anchor a on f.ID = a.FLOOR_ID JOIN tag t on a.ID = t.ANCHOR_ID WHERE location.NAME = ?';

            $statement = $this->execute_selecting($this->query, 's', $location);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_LOCATION_INFO);
            }

            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {

                $result_array[] = array('name' => $row['NAME']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that returns all the locations
     * @return array|db_errors
     */
    function get_all_locations()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ID, NAME, DESCRIPTION, LATITUDE, LONGITUDE, RADIUS, IS_INSIDE FROM location';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_LOCATIONS);
            }

            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'description' => $row['DESCRIPTION'], 'latitude' => (double)$row['LATITUDE'],
                    'longitude' => (double)$row['LONGITUDE'], 'radius' => $row['RADIUS'], 'is_inside' => (int)$row['IS_INSIDE']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the locations of the user
     * @param $user
     * @return array|db_errors|mysqli_stmt
     */
    function get_locations_by_user($user)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT location.ID, location.NAME, DESCRIPTION, LATITUDE, LONGITUDE, RADIUS, METER_RADIUS FROM location JOIN user_has_location uhl on location.ID = uhl.LOCATION_ID JOIN user ON uhl.USER_ID = user.ID WHERE user.NAME = ?';

            $statement = $this->execute_selecting($this->query, 's', $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_LOCATION_BY_USER);
            }

            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'description' => $row['DESCRIPTION'], 'latitude' => (double)$row['LATITUDE'],
                    'longitude' => (double)$row['LONGITUDE'], 'radius' => (double)$row['RADIUS'], 'meter_radius' => $row['METER_RADIUS']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that returns the history
     * @param $fromDate
     * @param $toDate
     * @param $tag
     * @param $event
     * @return array|db_errors|mysqli_stmt|null
     */
    function get_history($fromDate, $toDate, $tag, $event)
    {

        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $statement = null;
            $array_result = array();
            $anchorNullStatement = null;
            $anchorNullQuery = "";

            if (($tag == 'Qualsiasi' && $event == 'Qualsiasi') || ($tag == null && $event == 'Qualsiasi') || ($tag == 'Qualsiasi' && $event == null)) {
                $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE CAST(history.TIME AS DATE) BETWEEN ? AND ? ORDER BY history.time DESC";
                $statement = $this->execute_selecting($this->query, 'ss', $fromDate, $toDate);

                if ($statement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $statement;
                } else if ($statement == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $statement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => $row['ANCHOR_NAME'], 'tag' => $row['TAG_NAME'],
                        'location' => $row['LOCATION_NAME'], 'floor' => $row['FLOOR_NAME'], 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }

                $statement->close();

                $anchorNullQuery = "SELECT history.TIME, event.DESCRIPTION, history.TAG_X_POS, history.TAG_Y_POS, tag.NAME FROM history JOIN event ON history.EVENT_ID = event.ID
                            JOIN tag ON history.TAG_ID = tag.ID WHERE CAST(history.TIME AS DATE) BETWEEN ? AND ? AND history.ANCHOR_ID IS NULL ORDER BY history.time DESC";

                $anchorNullStatement = $this->execute_selecting($anchorNullQuery, 'ss', $fromDate, $toDate);

                if ($anchorNullStatement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $anchorNullStatement;
                } else if ($anchorNullStatement === false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $anchorNullStatement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => 'nessun dato', 'tag' => $row['NAME'],
                        'location' => 'nessun dato', 'floor' => 'nessun dato', 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }
            } else if ($tag != null && $event == 'Qualsiasi') {
                $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE tag.NAME = ? AND CAST(history.TIME AS DATE) BETWEEN ? AND ? ORDER BY history.time DESC";
                $statement = $this->execute_selecting($this->query, 'sss', $tag, $fromDate, $toDate);

                if ($statement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $statement;
                } else if ($statement == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $statement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => $row['ANCHOR_NAME'], 'tag' => $row['TAG_NAME'],
                        'location' => $row['LOCATION_NAME'], 'floor' => $row['FLOOR_NAME'], 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }

                $statement->close();

                $anchorNullQuery = "SELECT history.TIME, event.DESCRIPTION, history.TAG_X_POS, history.TAG_Y_POS, tag.NAME FROM history JOIN event ON history.EVENT_ID = event.ID
                            JOIN tag ON history.TAG_ID = tag.ID WHERE tag.NAME = ? AND CAST(history.TIME AS DATE) BETWEEN ? AND ? AND history.ANCHOR_ID IS NULL ORDER BY history.time DESC";

                $anchorNullStatement = $this->execute_selecting($anchorNullQuery, 'sss', $tag, $fromDate, $toDate);

                if ($anchorNullStatement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $anchorNullStatement;
                } else if ($anchorNullStatement === false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $anchorNullStatement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => 'nessun dato', 'tag' => $row['NAME'],
                        'location' => 'nessun dato', 'floor' => 'nessun dato', 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }
            } else if ($tag == 'Qualsiasi' && $event != null) {
                $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE event.DESCRIPTION = ? AND CAST(history.TIME AS DATE) BETWEEN ? AND ? ORDER BY history.time DESC";
                $statement = $this->execute_selecting($this->query, 'sss', $event, $fromDate, $toDate);

                if ($statement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $statement;
                } else if ($statement == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $statement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => $row['ANCHOR_NAME'], 'tag' => $row['TAG_NAME'],
                        'location' => $row['LOCATION_NAME'], 'floor' => $row['FLOOR_NAME'], 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }

                $statement->close();

                $anchorNullQuery = "SELECT history.TIME, event.DESCRIPTION, history.TAG_X_POS, history.TAG_Y_POS, tag.NAME FROM history JOIN event ON history.EVENT_ID = event.ID
                            JOIN tag ON history.TAG_ID = tag.ID WHERE event.DESCRIPTION = ? AND CAST(history.TIME AS DATE) BETWEEN ? AND ? AND history.ANCHOR_ID IS NULL ORDER BY history.time DESC";

                $anchorNullStatement = $this->execute_selecting($anchorNullQuery, 'sss', $event, $fromDate, $toDate);

                if ($anchorNullStatement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $anchorNullStatement;
                } else if ($anchorNullStatement === false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $anchorNullStatement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => 'nessun dato', 'tag' => $row['NAME'],
                        'location' => 'nessun dato', 'floor' => 'nessun dato', 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }
            } else if ($event == null && $tag != null) {
                $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE tag.NAME = ? AND CAST(history.TIME AS DATE) BETWEEN ? AND ? ORDER BY history.time DESC";
                $statement = $this->execute_selecting($this->query, 'sss', $tag, $fromDate, $toDate);

                if ($statement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $statement;
                } else if ($statement == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $statement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => $row['ANCHOR_NAME'], 'tag' => $row['TAG_NAME'],
                        'location' => $row['LOCATION_NAME'], 'floor' => $row['FLOOR_NAME'], 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }

                $statement->close();

                $anchorNullQuery = "SELECT history.TIME, event.DESCRIPTION, history.TAG_X_POS, history.TAG_Y_POS, tag.NAME FROM history JOIN event ON history.EVENT_ID = event.ID
                            JOIN tag ON history.TAG_ID = tag.ID WHERE tag.NAME = ? AND CAST(history.TIME AS DATE) BETWEEN ? AND ? AND history.ANCHOR_ID IS NULL ORDER BY history.time DESC";

                $anchorNullStatement = $this->execute_selecting($anchorNullQuery, 'sss', $tag, $fromDate, $toDate);

                if ($anchorNullStatement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $anchorNullStatement;
                } else if ($anchorNullStatement === false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $anchorNullStatement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => 'nessun dato', 'tag' => $row['NAME'],
                        'location' => 'nessun dato', 'floor' => 'nessun dato', 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }
            } else if ($event != null && $tag == null) {
                $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE event.DESCRIPTION = ? AND CAST(history.TIME AS DATE) BETWEEN ? AND ? ORDER BY history.time DESC";
                $statement = $this->execute_selecting($this->query, 'sss', $event, $fromDate, $toDate);

                if ($statement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $statement;
                } else if ($statement == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $statement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => $row['ANCHOR_NAME'], 'tag' => $row['TAG_NAME'],
                        'location' => $row['LOCATION_NAME'], 'floor' => $row['FLOOR_NAME'], 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }

                $statement->close();

                $anchorNullQuery = "SELECT history.TIME, event.DESCRIPTION, history.TAG_X_POS, history.TAG_Y_POS, tag.NAME FROM history JOIN event ON history.EVENT_ID = event.ID
                            JOIN tag ON history.TAG_ID = tag.ID WHERE event.DESCRIPTION = ? AND CAST(history.TIME AS DATE) BETWEEN ? AND ? AND history.ANCHOR_ID IS NULL ORDER BY history.time DESC";

                $anchorNullStatement = $this->execute_selecting($anchorNullQuery, 'sss', $event, $fromDate, $toDate);

                if ($anchorNullStatement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $anchorNullStatement;
                } else if ($anchorNullStatement === false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $anchorNullStatement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => 'nessun dato', 'tag' => $row['NAME'],
                        'location' => 'nessun dato', 'floor' => 'nessun dato', 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }
            } else if ($event != null && $tag != null) {
                $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE event.DESCRIPTION = ? AND tag.NAME = ? AND CAST(history.TIME AS DATE) BETWEEN ? AND ? ORDER BY history.time DESC";
                $statement = $this->execute_selecting($this->query, 'ssss', $event, $tag, $fromDate, $toDate);

                if ($statement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $statement;
                } else if ($statement == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $statement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => $row['ANCHOR_NAME'], 'tag' => $row['TAG_NAME'],
                        'location' => $row['LOCATION_NAME'], 'floor' => $row['FLOOR_NAME'], 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }

                $statement->close();

                $anchorNullQuery = "SELECT history.TIME, event.DESCRIPTION, history.TAG_X_POS, history.TAG_Y_POS, tag.NAME FROM history JOIN event ON history.EVENT_ID = event.ID
                            JOIN tag ON history.TAG_ID = tag.ID WHERE event.DESCRIPTION = ? AND tag.NAME = ? AND history.ANCHOR_ID IS NULL AND CAST(history.TIME AS DATE) BETWEEN ? AND ? ORDER BY history.time DESC";

                $anchorNullStatement = $this->execute_selecting($anchorNullQuery, 'ssss', $event, $tag, $fromDate, $toDate);

                if ($anchorNullStatement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $anchorNullStatement;
                } else if ($anchorNullStatement === false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $anchorNullStatement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => 'nessun dato', 'tag' => $row['NAME'],
                        'location' => 'nessun dato', 'floor' => 'nessun dato', 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }
            } else if ($tag == null && $event == null) {
                $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE CAST(history.TIME AS DATE) BETWEEN ? AND ? ORDER BY history.time DESC";
                $statement = $this->execute_selecting($this->query, 'ss', $fromDate, $toDate);

                if ($statement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $statement;
                } else if ($statement == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $statement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => $row['ANCHOR_NAME'], 'tag' => $row['TAG_NAME'],
                        'location' => $row['LOCATION_NAME'], 'floor' => $row['FLOOR_NAME'], 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }

                $statement->close();

                $anchorNullQuery = "SELECT history.TIME, event.DESCRIPTION, history.TAG_X_POS, history.TAG_Y_POS, tag.NAME FROM history JOIN event ON history.EVENT_ID = event.ID
                            JOIN tag ON history.TAG_ID = tag.ID WHERE CAST(history.TIME AS DATE) BETWEEN ? AND ? AND history.ANCHOR_ID IS NULL ORDER BY history.time DESC";

                $anchorNullStatement = $this->execute_selecting($anchorNullQuery, 'ss', $fromDate, $toDate);

                if ($anchorNullStatement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $anchorNullStatement;
                } else if ($anchorNullStatement === false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_HISTORY);
                }
                $this->result = $anchorNullStatement->get_result();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => 'nessun dato', 'tag' => $row['NAME'],
                        'location' => 'nessun dato', 'floor' => 'nessun dato', 'tag_x_pos' => $row['TAG_X_POS'],
                        'tag_y_pos' => $row['TAG_Y_POS']);
                }
            }


            mysqli_close($this->connection);
            return $array_result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * @param $fromDate
     * @param $toDate
     * @return db_errors|int|mysqli_stmt
     */
    function delete_history($fromDate, $toDate)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM history WHERE history.TIME BETWEEN ? AND ?';

            $statement = $this->execute_selecting($this->query, 'ss', $fromDate, $toDate);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_MAC);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that retrieve the image of the floor passed as the parameter on the location passed as parameter
     * @param $location - the location where the floor is
     * @return db_errors|array
     */
    function get_floor_info($location, $floor_name)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT floor.ID, floor.NAME, floor.MAP_WIDTH, floor.MAP_SPACING, floor.IMAGE_MAP FROM floor JOIN location ON floor.LOCATION_ID = location.ID WHERE location.NAME = ? 
                            AND floor.NAME = ?';

            $statement = $this->execute_selecting($this->query, 'ss', $location, $floor_name);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_INFO);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'width' => $row['MAP_WIDTH'], 'spacing' => $row['MAP_SPACING'], 'image_map' => $row['IMAGE_MAP']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the tags of a certain floor
     * @param $tag
     * @return array|db_errors|mysqli_stmt
     */
    function get_tag_floor($tag)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT floor.ID, floor.NAME, floor.IMAGE_MAP, floor.MAP_WIDTH, l.NAME AS location_name FROM tag JOIN anchor ON tag.ANCHOR_ID = anchor.ID JOIN floor 
                        ON anchor.FLOOR_ID = floor.ID JOIN location l on floor.LOCATION_ID = l.ID WHERE tag.ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $tag);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array = array('id' => $row['ID'], 'name' => $row['NAME'], 'image_map' => $row['IMAGE_MAP'], 'width' => $row['MAP_WIDTH'],
                    'location_name' => $row['location_name']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the anchors of a certain floor in a certain location
     * @param $floor
     * @param $location
     * @return array|db_errors|mysqli_stmt
     */
    function get_anchors_by_floor_and_location($floor, $location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT anchor.ID, anchor.MAC, anchor.NAME, X_POS, Y_POS, Z_POS, anchor.RADIUS, IP, RSSI_THRESHOLD, PROXIMITY, anchor_types.DESCRIPTION, PERMITTED_ASSET, IS_OFFLINE, 
                        EMERGENCY_ZONE, NEIGHBORS, BATTERY_STATUS, FLOOR_ID, floor.NAME AS FLOOR_NAME, l.NAME AS LOCATION_NAME FROM anchor JOIN floor ON anchor.FLOOR_ID = floor.ID JOIN location l ON floor.LOCATION_ID = l.ID
                        JOIN anchor_types ON anchor.TYPE = anchor_types.ID WHERE floor.NAME = ? AND l.NAME = ? ORDER BY anchor.NAME';

            $statement = $this->execute_selecting($this->query, 'ss', $floor, $location);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_ANCHORS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'mac' => $row['MAC'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'],
                    'z_pos' => $row['Z_POS'], 'radius' => $row['RADIUS'], 'ip' => $row['IP'], 'rssi' => $row['RSSI_THRESHOLD'], 'proximity' => $row['PROXIMITY'],
                    'type' => $row['DESCRIPTION'], 'permitted_asset' => $row['PERMITTED_ASSET'], 'is_offline' => $row['IS_OFFLINE'], 'emergency_zone' => $row['EMERGENCY_ZONE'],
                    'neighbors' => $row['NEIGHBORS'], 'battery_status' => $row['BATTERY_STATUS'], 'floor_id' => $row['FLOOR_ID'], 'floor_name' => $row['FLOOR_NAME'], 'location_name' => $row['LOCATION_NAME']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets the anchors of a certain location
     * @param $location
     * @return array|db_errors|mysqli_stmt
     */
    function get_anchors_by_location($location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT anchor.ID, anchor.MAC, anchor.NAME, X_POS, Y_POS, Z_POS, anchor.RADIUS, IP, RSSI_THRESHOLD, PROXIMITY, anchor_types.DESCRIPTION, PERMITTED_ASSET, IS_OFFLINE, 
                        EMERGENCY_ZONE, NEIGHBORS, BATTERY_STATUS, floor.ID AS FLOOR_ID, floor.NAME AS FLOOR_NAME 
                        FROM anchor JOIN anchor_types ON anchor.TYPE = anchor_types.ID JOIN floor ON anchor.FLOOR_ID = floor.ID JOIN location l on floor.LOCATION_ID = l.ID WHERE l.NAME = ? ORDER BY anchor.NAME';

            $statement = $this->execute_selecting($this->query, 's', $location);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_ANCHORS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'mac' => $row['MAC'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'], 'is_offline' => $row['IS_OFFLINE'], 'floor_name' => $row['FLOOR_NAME'],
                    'z_pos' => $row['Z_POS'], 'r
                    adius' => $row['RADIUS'], 'ip' => $row['IP'], 'rssi' => $row['RSSI_THRESHOLD'], 'proximity' => $row['PROXIMITY'], 'battery_status' => $row['BATTERY_STATUS'], 'floor_id' => $row['FLOOR_ID'],
                    'type' => $row['DESCRIPTION'], 'permitted_asset' => $row['PERMITTED_ASSET'], 'emergency_zone' => $row['EMERGENCY_ZONE'], 'neighbors' => $row['NEIGHBORS'], 'location_name' => $location);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the anchors of a certain user
     * @param $user
     * @return array|db_errors|mysqli_stmt
     */
    function get_anchors_by_user($user)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT anchor.ID, anchor.NAME, X_POS, Y_POS, Z_POS, BATTERY_STATUS, anchor.RADIUS, IP, RSSI_THRESHOLD, PROXIMITY, 
                        anchor_types.DESCRIPTION, PERMITTED_ASSET, IS_OFFLINE, floor.NAME AS FLOOR_NAME, l.NAME AS LOCATION_NAME, l.LATITUDE AS LOCATION_LATITUDE, l.LONGITUDE AS LOCATION_LONGITUDE
                        FROM anchor JOIN anchor_types ON anchor.TYPE = anchor_types.ID JOIN floor ON anchor.FLOOR_ID = floor.ID JOIN location l on floor.LOCATION_ID = l.ID 
                        JOIN user_has_location uhl on l.ID = uhl.LOCATION_ID JOIN user ON uhl.USER_ID = user.ID WHERE user.NAME = ? ORDER BY anchor.NAME';

            $statement = $this->execute_selecting($this->query, 's', $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_ANCHORS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'],
                    'z_pos' => $row['Z_POS'], 'battery_status' => $row['BATTERY_STATUS'], 'radius' => $row['RADIUS'], 'ip' => $row['IP'], 'rssi' => $row['RSSI_THRESHOLD'], 'proximity' => $row['PROXIMITY'],
                    'type' => $row['DESCRIPTION'], 'permitted_asset' => $row['PERMITTED_ASSET'], 'is_offline' => $row['IS_OFFLINE'], 'floor_name' => $row['FLOOR_NAME'],
                    'location_name' => $row['LOCATION_NAME'], 'location_longitude' => $row['LOCATION_LONGITUDE'], 'location_latitude' => $row['LOCATION_LATITUDE']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the cameras from a certain floor in a certain location
     * @param $floor
     * @param $location
     * @return array|db_errors|mysqli_stmt
     */
    function get_cameras_by_floor_and_location($floor, $location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT camera.ID, camera.DESCRIPTION, USERNAME, PASSWORD, X_POS, Y_POS, camera.RADIUS FROM camera 
                        JOIN floor ON FLOOR_ID = floor.ID JOIN location ON floor.LOCATION_ID = location.ID WHERE floor.NAME = ? AND location.NAME = ?';

            $statement = $this->execute_selecting($this->query, 'ss', $floor, $location);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_CAMERAS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'description' => $row['DESCRIPTION'], 'username' => $row['USERNAME'],
                    'password' => $row['PASSWORD'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'], 'radius' => $row['RADIUS']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the tags of a certain user
     * @param $user
     * @return array|db_errors|mysqli_stmt
     */
    function get_tags_by_user($user)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT t.ID, t.NAME, tt.DESCRIPTION AS TYPE, t.X_POS, t.Y_POS, t.TIME, t.BATTERY_STATUS, t.GPS_NORTH_DEGREE, t.MAN_DOWN, t.GPS_EAST_DEGREE,
                        t.MAN_DOWN_DISABLED, t.MAN_DOWN_TACITATED, t.SOS, t.MAN_IN_QUOTE, t.CALL_ME_ALARM, t.RADIO_SWITCHED_OFF, t.DIAGNOSTIC_REQUEST, 
                        t.INSIDE_ZONE, t.IS_EXIT, floor.NAME AS FLOOR_NAME, floor.IMAGE_MAP, anchor.NAME AS ANCHOR_NAME, tt.ID AS TYPE_ID, tt.SLEEP_TIME_INDOOR, tt.SLEEP_TIME_OUTDOOR, tt.ICON_NAME,
                        dress_alarm.HELMET_DPI, dress_alarm.BELT_DPI, dress_alarm.GLOVE_DPI, dress_alarm.SHOE_DPI, l.NAME AS LOCATION_NAME, l.LONGITUDE AS LOCATION_LONGITUDE, l.LATITUDE AS LOCATION_LATITUDE
                        FROM user JOIN user_has_location uhl ON user.ID = uhl.USER_ID
                        JOIN location l ON uhl.LOCATION_ID = l.ID JOIN floor ON l.ID = floor.LOCATION_ID JOIN anchor ON floor.ID = anchor.FLOOR_ID
                        JOIN tag t ON anchor.ID = t.ANCHOR_ID JOIN tag_types AS tt ON t.TYPE = tt.ID JOIN dress_alarm ON t.ID = dress_alarm.TAG_ID WHERE user.USERNAME = ?';

            $statement = $this->execute_selecting($this->query, 's', $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'type_name' => $row['TYPE'], 'x_pos' => $row['X_POS'], 'y_pos' => $row['Y_POS'],
                    'gps_north_degree' => $row['GPS_NORTH_DEGREE'], 'gps_east_degree' => $row['GPS_EAST_DEGREE'], 'radio_switched_off' => $row['RADIO_SWITCHED_OFF'],
                    'battery_status' => $row['BATTERY_STATUS'], 'man_down' => $row['MAN_DOWN'],
                    'man_down_disabled' => $row['MAN_DOWN_DISABLED'], 'man_down_tacitated' => $row['MAN_DOWN_TACITATED'],
                    'sos' => $row['SOS'], 'man_in_quote' => $row['MAN_IN_QUOTE'], 'call_me_alarm' => $row['CALL_ME_ALARM'],
                    'diagnostic_request' => $row['DIAGNOSTIC_REQUEST'],
                    'sleep_time_outdoor' => $row['SLEEP_TIME_OUTDOOR'], 'sleep_time_indoor' => $row['SLEEP_TIME_INDOOR'], 'type_icon' => $row['ICON_NAME'],
                    'location_name' => $row['LOCATION_NAME'], 'location_longitude' => $row['LOCATION_LONGITUDE'], 'location_latitude' => $row['LOCATION_LATITUDE'], 'floor_name' => $row['FLOOR_NAME'], 'floor_image' => $row['IMAGE_MAP'],
                    'time' => $row['TIME'], 'inside_zone' => $row['INSIDE_ZONE'], 'is_exit' => $row['IS_EXIT'], 'anchor_name' => $row['ANCHOR_NAME'], 'type_id' => $row['TYPE_ID'],
                    'helmet_dpi' => $row['HELMET_DPI'], 'belt_dpi' => $row['BELT_DPI'], 'glove_dpi' => $row['GLOVE_DPI'], 'shoe_dpi' => $row['SHOE_DPI']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the tags
     * @return array|db_errors
     */
    function get_all_tags()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT t.ID, t.NAME, tt.DESCRIPTION AS TYPE, t.X_POS, t.Y_POS, t.TIME, t.BATTERY_STATUS, t.GPS_NORTH_DEGREE, t.MAN_DOWN, t.GPS_EAST_DEGREE,
                        t.MAN_DOWN_DISABLED, t.MAN_DOWN_TACITATED, t.SOS, t.GPS_TIME, t.ALARM_TIME, t.MAN_IN_QUOTE, t.CALL_ME_ALARM, t.RADIO_SWITCHED_OFF, t.DIAGNOSTIC_REQUEST, 
                        t.INSIDE_ZONE, t.IS_EXIT, t.ANCHOR_ID, tt.ID AS TYPE_ID, tt.SLEEP_TIME_INDOOR, tt.SLEEP_TIME_OUTDOOR, tt.ICON_NAME,
                        dress_alarm.HELMET_DPI, dress_alarm.BELT_DPI, dress_alarm.GLOVE_DPI, dress_alarm.SHOE_DPI, c.ID AS CATEGORY_ID, c.DESCRIPTION AS CATEGORY_DESCRIPTION, 
                        c.ICON_NAME_ALARM AS ICON_NAME_ALARM, c.ICON_NAME_NO_ALARM AS ICON_NAME_NO_ALARM
                        FROM tag AS t JOIN tag_types AS tt ON t.TYPE = tt.ID JOIN dress_alarm ON t.ID = dress_alarm.TAG_ID LEFT JOIN category c on t.CATEGORY_ID = c.ID';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
            }

            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => (int)$row['ID'], 'name' => $row['NAME'], 'type_name' => $row['TYPE'], 'x_pos' => (double)$row['X_POS'], 'y_pos' => (double)$row['Y_POS'],
                    'gps_north_degree' => (double)$row['GPS_NORTH_DEGREE'], 'gps_east_degree' => (double)$row['GPS_EAST_DEGREE'], 'radio_switched_off' => (int)$row['RADIO_SWITCHED_OFF'],
                    'battery_status' => (int)$row['BATTERY_STATUS'], 'man_down' => (int)$row['MAN_DOWN'],
                    'man_down_disabled' => (int)$row['MAN_DOWN_DISABLED'], 'man_down_tacitated' => (int)$row['MAN_DOWN_TACITATED'],
                    'sos' => (int)$row['SOS'], 'man_in_quote' => (int)$row['MAN_IN_QUOTE'], 'call_me_alarm' => (int)$row['CALL_ME_ALARM'],
                    'diagnostic_request' => (int)$row['DIAGNOSTIC_REQUEST'], 'gps_time' => $row['GPS_TIME'],
                    'sleep_time_outdoor' => (int)$row['SLEEP_TIME_OUTDOOR'], 'sleep_time_indoor' => (int)$row['SLEEP_TIME_INDOOR'], 'type_icon' => $row['ICON_NAME'],
                    'time' => $row['TIME'], 'alarm_time' => $row['ALARM_TIME'], 'inside_zone' => (int)$row['INSIDE_ZONE'], 'is_exit' => (int)$row['IS_EXIT'], 'anchor_id' => $row['ANCHOR_ID'], 'type_id' => (int)$row['TYPE_ID'],
                    'helmet_dpi' => (int)$row['HELMET_DPI'], 'belt_dpi' => (int)$row['BELT_DPI'], 'glove_dpi' => (int)$row['GLOVE_DPI'], 'shoe_dpi' => (int)$row['SHOE_DPI'],
                    'category_id' => $row['CATEGORY_ID'], 'category_description' => $row['CATEGORY_DESCRIPTION'], 'icon_name_alarm' => $row['ICON_NAME_ALARM'],
                    'icon_name_no_alarm' => $row['ICON_NAME_NO_ALARM']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the tags
     * @return array|db_errors
     */
    function get_tag_categories()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

            if ($this->connection) {
                $this->query = 'SELECT ID, DESCRIPTION, ICON_NAME_ALARM, ICON_NAME_NO_ALARM FROM category';

                $this->result = $this->connection->query($this->query);

                if ($this->result == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
                }

                $result_array = array();

                while ($row = mysqli_fetch_assoc($this->result)) {
                    $result_array[] = array('id' => (int)$row['ID'], 'name' => $row['DESCRIPTION'], 'alarm_image' => $row['ICON_NAME_ALARM'], 'no_alarm_image' => $row['ICON_NAME_NO_ALARM']);
                }
                mysqli_close($this->connection);
                return $result_array;
            }

//            $this->query = 'SELECT c.ID, t.ID as t_id, DESCRIPTION, ICON_NAME_ALARM, ICON_NAME_NO_ALARM FROM tag as t JOIN category as c ON t.CATEGORY_ID = c.ID';
//
//            $this->result = $this->connection->query($this->query);
//
//            if ($this->result == false) {
//                mysqli_close($this->connection);
//                return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
//            }
//
//            $result_array = array();
//            $temp_array = array();
//            while ($row = mysqli_fetch_assoc($this->result)) {
//                $temp_array[$row['ID']][] = $row['t_id'];
//                $result_array[$row['ID']] = array('id' => (int)$row['ID'], 'name' => $row['DESCRIPTION'], 'alarm_image' => $row['ICON_NAME_ALARM'], 'no_alarm_image' => $row['ICON_NAME_NO_ALARM']);
//            }
//
//            foreach ($temp_array as $key => $value){
//                array_push($result_array[$key], $value);
//            }
//
//            mysqli_close($this->connection);
//            return $result_array;
//            return $temp_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the tags
     * @return array|db_errors
     */
    function get_categorie_tags()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT c.ID, t.ID as t_id, DESCRIPTION, ICON_NAME_ALARM, ICON_NAME_NO_ALARM FROM tag as t JOIN category as c ON t.CATEGORY_ID = c.ID';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
            }

            $result_array = array();
            $temp_array = array();
            while ($row = mysqli_fetch_assoc($this->result)) {
                $temp_array[$row['ID']][] = $row['t_id'];
                $result_array[$row['ID']] = array('id' => (int)$row['ID']);
            }

            foreach ($temp_array as $key => $value){
                array_push($result_array[$key], $value);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the tags
     * @return array|db_errors
     */
    function get_safety_box()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ID, NAME, IMEI FROM safety_box';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
            }

            $result_array = array();
            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => (int)$row['ID'], 'name' => $row['NAME'], 'imei' => $row['IMEI']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the anchors types
     * @return array|db_errors
     */
    function get_anchor_types()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ID, DESCRIPTION FROM anchor_types';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_ANCHOR_TYPES);
            }
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => (int)$row['ID'], 'description' => $row['DESCRIPTION']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the tags from a certain floor in a certain location
     * @param $floor
     * @param $location
     * @return array|db_errors|mysqli_stmt
     */
    function get_tags_by_floor_and_location($floor, $location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT tag.ID, tag.NAME, tag.X_POS, tag.Y_POS, tag.TIME, tag.GPS_TIME, tag.ALARM_TIME, tag.BATTERY_STATUS, tag.GPS_NORTH_DEGREE, tag.MAN_DOWN, tag.GPS_EAST_DEGREE,
                        tag.MAN_DOWN_DISABLED, tag.MAN_DOWN_DISABLED_ALERTED, tag.MAN_DOWN_TACITATED, tag.SOS, tag.SOS_ALERTED, tag.MAN_IN_QUOTE, tag.MAN_IN_QUOTE_ALERTED,
                        tag.CALL_ME_ALARM, tag.EVACUATION_ALARM, tag.RADIO_SWITCHED_OFF, tag.DIAGNOSTIC_REQUEST, tag.INSIDE_ZONE, tag.IS_EXIT, floor.NAME AS FLOOR_NAME, a.NAME AS ANCHOR_NAME, 
                        tag_types.ID AS TYPE_ID, c.ID AS CATEGORY_ID, c.DESCRIPTION AS CATEGORY_DESCRIPTION, c.ICON_NAME_ALARM, c.ICON_NAME_NO_ALARM, tag_types.DESCRIPTION AS TAG_TYPE_NAME, tag_types.SLEEP_TIME_INDOOR, dress_alarm.HELMET_DPI, dress_alarm.BELT_DPI, dress_alarm.GLOVE_DPI, dress_alarm.SHOE_DPI
                        FROM tag JOIN anchor a ON tag.ANCHOR_ID = a.ID JOIN floor ON a.FLOOR_ID = floor.ID JOIN tag_types ON tag. TYPE = tag_types.ID 
                        JOIN location l ON floor.LOCATION_ID = l.ID JOIN dress_alarm ON tag.ID = dress_alarm.TAG_ID LEFT JOIN category c on tag.CATEGORY_ID = c.ID
                        WHERE floor.ID = ? AND l.NAME = ? AND tag.GPS_NORTH_DEGREE = 0 AND tag.GPS_EAST_DEGREE = 0';

            $statement = $this->execute_selecting($this->query, 'ss', $floor, $location);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], 'y_pos' => $row['Y_POS'], 'time' => $row['TIME'], 'gps_time' => $row['GPS_TIME'], 'alarm_time' => $row['ALARM_TIME'], 'battery_status' => $row['BATTERY_STATUS'],
                    'gps_north_degree' => $row['GPS_NORTH_DEGREE'], 'man_down' => $row['MAN_DOWN'], 'gps_east_degree' => $row['GPS_EAST_DEGREE'],
                    'man_down_disabled' => $row['MAN_DOWN_DISABLED'], 'man_down_disabled_alerted' => $row['MAN_DOWN_DISABLED_ALERTED'], 'man_down_tacitated' => $row['MAN_DOWN_TACITATED'],
                    'sos' => $row['SOS'], 'sos_alerted' => $row['SOS_ALERTED'], 'man_in_quote' => $row['MAN_IN_QUOTE'], 'man_in_quote_alerted' => $row['MAN_IN_QUOTE_ALERTED'],
                    'call_me_alarm' => $row['CALL_ME_ALARM'], 'evacuation_alarm' => $row['EVACUATION_ALARM'], 'radio_switched_off' => $row['RADIO_SWITCHED_OFF'],
                    'diagnostic_request' => $row['DIAGNOSTIC_REQUEST'], 'inside_zone' => $row['INSIDE_ZONE'], 'is_exit' => $row['IS_EXIT'], 'floor_name' => $row['FLOOR_NAME'], 'anchor_name' => $row['ANCHOR_NAME'],
                    'tag_type_id' => $row['TYPE_ID'], 'tag_type_name' => $row['TAG_TYPE_NAME'], 'sleep_time_indoor' => $row['SLEEP_TIME_INDOOR'],
                    'helmet_dpi' => $row['HELMET_DPI'], 'belt_dpi' => $row['BELT_DPI'], 'glove_dpi' => $row['GLOVE_DPI'], 'shoe_dpi' => $row['SHOE_DPI'], 'category_id' => $row['CATEGORY_ID'],
                    'category_description' => $row['CATEGORY_DESCRIPTION'], 'icon_name_alarm' => $row['ICON_NAME_ALARM'], 'icon_name_no_alarm' => $row['ICON_NAME_NO_ALARM']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the events
     * @return array|db_errors
     */
    function get_events()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ID, DESCRIPTION, ICON_NAME FROM event';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_EVENTS);
            }
            $array_result = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $array_result[] = array('id' => $row['ID'], 'description' => $row['DESCRIPTION'], 'icon_name' => $row['ICON_NAME']);
            }

            mysqli_close($this->connection);
            return $array_result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the floors in a certain location
     * @param $location
     * @return array|db_errors|mysqli_stmt
     */
    function get_floors_by_location($location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT floor.ID, floor.NAME, floor.IMAGE_MAP, floor.MAP_WIDTH, floor.MAP_SPACING FROM floor JOIN location ON floor.LOCATION_ID = location.ID WHERE location.NAME = ?';

            $statement = $this->execute_selecting($this->query, 's', $location);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_FLOORS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'image_map' => $row['IMAGE_MAP'], 'width' => $row['MAP_WIDTH'], 'map_spacing' => $row['MAP_SPACING']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets all the floors of a certain user
     * @param $user
     * @return array|db_errors|mysqli_stmt
     */
    function get_floors_by_user($user)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT floor.ID, floor.NAME, floor.IMAGE_MAP, floor.MAP_WIDTH, floor.MAP_SPACING FROM floor 
                        JOIN location ON floor.LOCATION_ID = location.ID JOIN user_has_location ON location.ID = user_has_location.LOCATION_ID
                        JOIN user ON user_has_location.USER_ID = user.ID WHERE user.NAME = ?';

            $statement = $this->execute_selecting($this->query, 's', $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_FLOORS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'image_map' => $row['IMAGE_MAP'], 'width' => $row['MAP_WIDTH'], 'map_spacing' => $row['MAP_SPACING']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that updates the floor image
     * @param $name
     * @param $id
     * @return db_errors|int|mysqli_stmt
     */
    function update_floor_image($name, $id)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE floor SET IMAGE_MAP = ? WHERE ID = ?";

            $statement = $this->execute_selecting($this->query, 'ss', $name, $id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_UPDATING_FLOOR_IMAGE);
            }

            $aff_rows = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that change the value of a mac field
     * @param $mac_id
     * @param $mac_field
     * @param $field_value
     * @return db_errors|int|mysqli_stmt
     */
    function change_mac_field($mac_id, $mac_field, $field_value)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE tag_mac SET " . strtoupper($mac_field) . " = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ss', $field_value, $mac_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }
            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that change the value of a mac field
     * @param $category_id
     * @param $category_field
     * @param $field_value
     * @return db_errors|int|mysqli_stmt
     */
    function change_tag_category_field($category_id, $category_field, $field_value)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE category SET " . strtoupper($category_field) . " = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ss', $field_value, $category_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }
            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that change the value of a mac field
     * @param $safety_box_ic
     * @param $safety_box_field
     * @param $field_value
     * @return db_errors|int|mysqli_stmt
     */
    function change_safety_box_field($safety_box_id,  $safety_box_field, $field_value)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE safety_box SET " . strtoupper($safety_box_field) . " = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ss', $field_value, $safety_box_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }
            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that change the value of a tag field
     * @param $tag_id
     * @param $tag_field
     * @param $field_value
     * @return db_errors|int|mysqli_stmt
     */
    function change_tag_field($tag_id, $tag_field, $field_value)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE tag SET " . strtoupper($tag_field) . " = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ss', $field_value, $tag_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }
            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that change the value of a tag field
     * @param $tag_id
     * @param $type
     * @return array
     */
    function update_tag_type($tag_id, $type)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection->autocommit(false);
            $errors = array();

            $this->query = "UPDATE tag SET TYPE = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ii', $type, $tag_id);

            if ($statement instanceof db_errors)
                array_push($errors, 'update_tag_type_db_error');
            else if ($statement == false)
                array_push($errors, 'update_tag_type_error');

            $this->query = 'UPDATE wetag_settings SET TYPE = ? WHERE TAG_ID = ?';
            $statement = $this->execute_inserting($this->query, 'ii', $type, $tag_id);

            if ($statement instanceof db_errors)
                array_push($errors, 'update_tag_settings_db_error');
            else if ($statement == false)
                array_push($errors, 'update_tag_settings_error');

            if (!empty($errors)) {
                $this->connection->rollback();
            }

            $this->connection->commit();

            mysqli_close($this->connection);

            return $errors;
        }
    }

    /**
     * Function that changes the value of a location field
     * @param $location_id
     * @param $location_field
     * @param $field_value
     * @return db_errors|int|mysqli_stmt
     */
    function change_location_field($location_id, $location_field, $field_value)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE location SET " . strtoupper($location_field) . " = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ss', $field_value, $location_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }

            $aff_rows = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that changes the value of an anchor field
     * @param $anchor_id
     * @param $anchor_field
     * @param $field_value
     * @return db_errors|int|mysqli_stmt
     */
    function change_anchor_field($anchor_id, $anchor_field, $field_value)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE anchor SET " . strtoupper($anchor_field) . " = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'si', $field_value, $anchor_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }
            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that changes the value of an anchor field
     * @param $anchor_id
     * @param $permitteds
     * @return db_errors|int|mysqli_stmt
     */
    function update_anchor_permitteds($anchor_id, $permitteds)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {

            $permittedString = '';

            if (substr($permitteds, -1, 1) == ',')
                $permittedString = substr($permitteds, 0, -1);

            $this->query = "UPDATE anchor SET anchor.PERMITTED_ASSET = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'si', $permittedString, $anchor_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }
            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that changes the value of a floor field
     * @param $floor_id
     * @param $floor_field
     * @param $field_value
     * @return db_errors|int|mysqli_stmt
     */
    function change_floor_field($floor_id, $floor_field, $field_value)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE floor SET " . strtoupper($floor_field) . " = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'si', $field_value, $floor_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }
            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that gets the emergency state
     * @param $location
     * @param $floor
     * @return array|db_errors|mysqli_stmt
     */
    function get_emergency_info($location, $floor)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT tag.NAME AS TAG_NAME, a.NAME AS ANCHOR_NAME FROM tag JOIN anchor a ON tag.ANCHOR_ID = a.ID JOIN floor ON a.FLOOR_ID = floor.ID JOIN location l ON floor.LOCATION_ID = l.ID
                        WHERE l.NAME = ? AND floor.NAME = ? AND a.EMERGENCY_ZONE = 1';

            $statement = $this->execute_selecting($this->query, 'ss', $location, $floor);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_EMERGENCY);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('tag_name' => $row['TAG_NAME'], 'anchor_name' => $row['ANCHOR_NAME']);
            }

            mysqli_close($this->connection);

            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_tag_outside_location_zoom()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "SELECT ZOOM_TAG_OUTSIDE_LOCATION FROM rtls WHERE ID = ?";

            $statement = $this->execute_selecting($this->query, 'i', 1);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_TAG_OUTDOOR_LOCATION_ZOOM);
            }
            $statement->bind_result($res_zoom);
            $fetch = $statement->fetch();

            if ($fetch) {
                mysqli_close($this->connection);
                return $res_zoom;
            }

            mysqli_close($this->connection);
        }
        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_user($user)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "SELECT ID, USERNAME, ONE_LOCATION, ROLE, PASSWORD_CHANGED FROM user WHERE USERNAME = ?";

            $statement = $this->execute_selecting($this->query, 's', $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_USER_SETTINGS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'username' => $row['USERNAME'], 'one_location' => $row['ONE_LOCATION'], 'role' => $row['ROLE'],
                    'password_changed' => $row['PASSWORD_CHANGED']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_user_settings($user)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "SELECT grid_on, anchors_on, cameras_on, outag_on, zones_on, sound_on, outdoor_tag_on FROM user JOIN user_settings ON USER_SETTINGS = user_settings.id WHERE NAME = ?";

            $statement = $this->execute_selecting($this->query, 's', $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_USER_SETTINGS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('grid_on' => $row['grid_on'], 'anchors_on' => $row['anchors_on'], 'cameras_on' => $row['cameras_on'],
                    'outag_on' => $row['outag_on'], 'zones_on' => $row['zones_on'], 'sound_on' => $row['sound_on'],
                    'outdoor_tag_on' => $row['outdoor_tag_on']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function update_user_settings($user, $data)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $decoded = json_decode($data, true);
            $this->query = "UPDATE user_settings us JOIN user ON us.id = user.USER_SETTINGS 
                            SET us.grid_on = ?, us.anchors_on = ?, us.cameras_on = ?, us.outag_on = ?, us.zones_on = ?, us.sound_on = ?, us.outdoor_tag_on = ? WHERE user.NAME = ?";

            $statement = $this->execute_selecting($this->query, 'iiiiiiis', $decoded['grid_on'], $decoded['anchors_on'],
                $decoded['cameras_on'], $decoded['outag_on'], $decoded['zones_on'], $decoded['sound_on'], $decoded['outdoor_tag_on'], $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
            }

            $aff_rows = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function update_user_role($user, $role)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE user SET ROLE= ? WHERE user.ID = ?";

            $statement = $this->execute_selecting($this->query, 'ii', $role, $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
            }

            $aff_rows = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che recupera tutti i tipi di un tag
     * @param $floor
     * @param $location
     * @param $user
     * @return array|db_errors
     */
    function get_floor_zones($floor, $location, $user)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "SELECT zone.ID, zone.NAME, X_LEFT, X_RIGHT, Y_UP, Y_DOWN, COLOR, FLOOR_ID FROM zone JOIN floor 
                            ON FLOOR_ID = floor.ID JOIN location l on floor.LOCATION_ID = l.ID JOIN user_has_location 
                            ON l.ID = user_has_location.LOCATION_ID JOIN user u ON user_has_location.USER_ID = u.ID 
                            WHERE floor.NAME = ? AND l.NAME = ? AND u.NAME = ?";

            $statement = $this->execute_selecting($this->query, 'sss', $floor, $location, $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_USER_SETTINGS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_left' => $row['X_LEFT'],
                    'x_right' => $row['X_RIGHT'], 'y_up' => $row['Y_UP'], 'y_down' => $row['Y_DOWN'],
                    'color' => $row['COLOR'], 'floor_id' => $row['FLOOR_ID']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che recupera tutti i tipi di un tag
     * @param $location
     * @return array|db_errors
     */
    function get_outdoor_zones($location)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "SELECT ID, NAME, X_LEFT, X_RIGHT, Y_UP, Y_DOWN, RADIUS, GPS_NORTH, GPS_EAST, FLOOR_ID, COLOR, LOCATION 
                            FROM zone WHERE LOCATION = ?";

            $statement = $this->execute_selecting($this->query, 's', $location);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_USER_SETTINGS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_left' => $row['X_LEFT'],
                    'x_right' => $row['X_RIGHT'], 'y_up' => $row['Y_UP'], 'y_down' => $row['Y_DOWN'],
                    'radius' => $row['RADIUS'], 'gps_north' => $row['GPS_NORTH'], 'gps_east' => $row['GPS_EAST'],
                    'floor' => $row['FLOOR_ID'], 'color' => $row['COLOR'], 'location' => $row['LOCATION']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che recupera tutti i tipi di un tag
     * @param $data
     * @return array|db_errors
     */
    function insert_floor_zone($data)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $decoded = json_decode($data, true);

            $this->query = "INSERT INTO zone (NAME, X_LEFT, X_RIGHT, Y_UP, Y_DOWN, COLOR, FLOOR_ID) VALUES (?, ?, ?, ?, ?, ?, ?)";

            $statement = $this->execute_inserting($this->query, 'siiiisi', $decoded['name'], $decoded['x_left'], $decoded['x_right'],
                $decoded['y_up'], $decoded['y_down'], $decoded['color'], $decoded['floor']);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_INSERTING_MAC);
            }

            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che recupera tutti i tipi di un tag
     * @param $data
     * @return array|db_errors
     */
    function insert_outdoor_rect_zone($data)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $decoded = json_decode($data, true);

            $this->query = "INSERT INTO zone (NAME, X_LEFT, X_RIGHT, Y_UP, Y_DOWN, COLOR, LOCATION) VALUES (?, ?, ?, ?, ?, ?, ?)";

            $statement = $this->execute_inserting($this->query, 'sddddss', $decoded['name'], $decoded['x_left'], $decoded['x_right'],
                $decoded['y_up'], $decoded['y_down'], $decoded['color'], $decoded['location']);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_INSERTING_MAC);
            }
            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Funzione che recupera tutti i tipi di un tag
     * @param $data
     * @return array|db_errors
     */
    function insert_outdoor_round_zone($data)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $decoded = json_decode($data, true);

            $this->query = "INSERT INTO zone (NAME, RADIUS, GPS_NORTH, GPS_EAST, COLOR, LOCATION) VALUES ( ?, ?, ?, ?, ?, ?)";

            $statement = $this->execute_inserting($this->query, 'sdddss', $decoded['name'], $decoded['radius'], $decoded['x'], $decoded['y'],
                $decoded['color'], $decoded['location']);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_INSERTING_MAC);
            }

            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that change the value of a tag field
     * @param $zone_id
     * @param $zone_field
     * @param $field_value
     * @return db_errors|int|mysqli_stmt
     */
    function change_zone_field($zone_id, $zone_field, $field_value)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE zone SET " . strtoupper($zone_field) . " = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ss', $field_value, $zone_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }
            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that change the value of a tag field
     * @param $zone_id
     * @param $zone_color
     * @return db_errors|int|mysqli_stmt
     */
    function update_zone_color($zone_id, $zone_color)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE zone SET COLOR = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ss', $zone_color, $zone_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }

            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that change the value of a tag field
     * @param $zone_id
     * @param $x_left
     * @param $x_right
     * @param $y_up
     * @param $y_down
     * @return db_errors|int|mysqli_stmt
     */
    function update_floor_zone($zone_id, $x_left, $x_right, $y_up, $y_down)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE zone SET X_LEFT = ?, X_RIGHT = ?, Y_UP = ?, Y_DOWN = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ddddd', $x_left, $x_right, $y_up, $y_down, $zone_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }
            $this->result = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $this->result;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /** Funzione che recupera tutti i tipi di un tag
     * @param $zone_id
     * @return array|db_errors
     */
    function delete_floor_zone($zone_id)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM zone WHERE ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $zone_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_MAC);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /** Funzione che recupera tutti i tipi di un tag
     * @param $tag_id
     * @return array|db_errors
     */
    function get_forbidden_zones($tag_id)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ZONE_ID, NAME FROM prohibitions JOIN zone ON ZONE_ID = ID WHERE TAG_ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $tag_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_MAC);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('zone_id' => $row['ZONE_ID'], 'name' => $row['NAME']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function insert_managed_zones($tag_id, $zones)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            for ($i = 0; $i < count($zones); $i++) {

                $this->query = "INSERT INTO prohibitions (TAG_ID, ZONE_ID) VALUES (?, ?)";

                $statement = $this->execute_inserting($this->query, 'ii', $tag_id, $zones[$i]);

                if ($statement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $statement;
                } else if ($statement == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_INSERTING_USER_HAS_LOCATION);
                }
            }

            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function delete_managed_zone($tag_id, $zone_id)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM prohibitions WHERE TAG_ID = ? AND ZONE_ID = ?';

            $statement = $this->execute_selecting($this->query, 'ii', $tag_id, $zone_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_USER_LOCATION);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_generic_users()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "SELECT ID, USERNAME, NAME, ROLE FROM user WHERE ROLE = 0";

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_LOCATIONS);
            }

            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'username' => $row['USERNAME'], 'name' => $row['NAME'], 'role' => $row['ROLE']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function insert_user($username, $name, $email)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection->autocommit(false);

            $errors = array();

            $password = generateRandomCode();

            if (!sendEmail($email, $password) instanceof db_errors) {

                $hash_code = password_hash($password, PASSWORD_BCRYPT);


                $this->query = "INSERT INTO user (USERNAME, PASSWORD, NAME, ROLE) VALUES (?, ?, ?, 0)";

                $statement = $this->execute_inserting($this->query, 'sss', $username, $hash_code, $name);

                if ($statement instanceof db_errors)
                    array_push($errors, 'insert_user_db_error');
                else if ($statement == false)
                    array_push($errors, 'insert_user_false');

                $this->query = 'INSERT INTO user_settings () VALUES ()';

                $statement = $this->connection->query($this->query);

                if (!$statement)
                    array_push($errors, 'user_settings_error');

                if (!empty($errors)) {
                    $this->connection->rollback();
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
                }

                $this->connection->commit();
                mysqli_close($this->connection);

                return $errors;
            } else {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_SENDING_EMAIL);
            }
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function delete_user($user)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM user WHERE ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_MAC);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function change_user_field($user_id, $user_field, $field_value)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "UPDATE user SET " . strtoupper($user_field) . " = ? WHERE ID = ?";
            $statement = $this->execute_selecting($this->query, 'ss', $field_value, $user_id);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }

            $aff_rows = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_all_users()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "SELECT ID, USERNAME, NAME, ROLE, EMAIL_ALERT, BOT_URL, BOT_CHAT_ID, WEB_SERVICE_URL, TELEPHONE_NUMBER FROM user WHERE ROLE = 0 OR ROLE = 2 OR ROLE = 3";

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_USERS);
            }
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'username' => $row['USERNAME'], 'name' => $row['NAME'], 'role' => $row['ROLE'], 'email_alert' => $row['EMAIL_ALERT'],
                    'bot_url' => $row['BOT_URL'], 'bot_chat_id' => $row['BOT_CHAT_ID'], 'web_service_url' => $row['WEB_SERVICE_URL'], 'telephone_number' => $row['TELEPHONE_NUMBER']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function insert_super_user($username, $name, $email, $phone, $email_list, $bot_url, $chat_id, $web_url, $role)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->connection->autocommit(false);

            $email_list_string = '';

            for ($i = 0; $i < count($email_list); $i++) {
                $email_list_string .= $email_list[$i] . ',';
            }

            if (substr($email_list_string, -1, 1) == ',')
                $email_list_string = substr($email_list_string, 0, -1);

            $errors = array();

            $password = generateRandomCode();

            if (!sendEmail($email, $password) instanceof db_errors) {
                if ($phone == '')
                    $phone = null;
                if ($email_list_string === '')
                    $email_list_string = null;
                if ($bot_url == '')
                    $bot_url = null;
                if ($chat_id == '')
                    $chat_id = null;
                if ($web_url == '')
                    $web_url = null;

                $hash_code = password_hash($password, PASSWORD_BCRYPT);

                $this->query = "INSERT INTO user (USERNAME, PASSWORD, NAME, TELEPHONE_NUMBER, EMAIL_ALERT, BOT_URL, BOT_CHAT_ID, WEB_SERVICE_URL, ROLE) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

                $statement = $this->execute_inserting($this->query, 'ssssssssi', $username, $hash_code, $name, $phone, $email_list_string, $bot_url, $chat_id, $web_url, $role);

                if ($statement instanceof db_errors)
                    array_push($errors, 'insert_user_db_error');
                else if ($statement == false)
                    array_push($errors, 'insert_user_false');

                $this->query = 'INSERT INTO user_settings () VALUES ()';

                $statement = $this->connection->query($this->query);

                if (!$statement)
                    array_push($errors, 'user_settings_error');

                if (!empty($errors)) {
                    $this->connection->rollback();
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
                }

                $this->connection->commit();

                mysqli_close($this->connection);
                return $errors;
            } else {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_SENDING_EMAIL);
            }
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_user_locations($user)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = "SELECT ID, NAME, LONGITUDE, LATITUDE, RADIUS, IS_INSIDE FROM location JOIN user_has_location ON location.ID = user_has_location.LOCATION_ID WHERE user_has_location.USER_ID  = ?";

            $statement = $this->execute_selecting($this->query, 'i', $user);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_USERS);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'longitude' => $row['LONGITUDE'],
                    'latitude' => $row['LATITUDE'], 'radius' => $row['RADIUS'], 'is_inside' => $row['IS_INSIDE']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function insert_managed_location($user, $locations)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            for ($i = 0; $i < count($locations); $i++) {

                $this->query = "INSERT INTO user_has_location (user_id, location_id) VALUES (?, ?)";

                $statement = $this->execute_inserting($this->query, 'ii', $user, $locations[$i]);

                if ($statement instanceof db_errors) {
                    mysqli_close($this->connection);
                    return $statement;
                } else if ($statement == false) {
                    mysqli_close($this->connection);
                    return new db_errors(db_errors::$ERROR_ON_INSERTING_USER_HAS_LOCATION);
                }
            }

            $id = $this->connection->insert_id;

            mysqli_close($this->connection);

            return $id;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function delete_managed_location($user, $locations)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'DELETE FROM user_has_location WHERE USER_ID = ? AND LOCATION_ID = ?';

            $statement = $this->execute_selecting($this->query, 'ii', $user, $locations);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_DELETING_USER_LOCATION);
            }

            $aff_rows = $statement->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_alpha()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT ZONE_ALPHA FROM rtls';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_MAC_TYPES);
            }

            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array = array('alpha' => $row['ZONE_ALPHA']);
            }

            mysqli_close($this->connection);

            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_engine_on()
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT TIME_LE FROM rtls WHERE TIMESTAMPDIFF(SECOND, TIME_LE, CURRENT_TIMESTAMP) <= 60';

            $this->result = $this->connection->query($this->query);

            if ($this->result == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_MAC_TYPES);
            }

            $rows = mysqli_num_rows($this->result);

            mysqli_close($this->connection);

            return $rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function get_indoor_tag_location($tag)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {
            $this->query = 'SELECT l.NAME FROM tag JOIN anchor a on tag.ANCHOR_ID = a.ID JOIN floor f on a.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID WHERE tag.ID = ?';

            $statement = $this->execute_selecting($this->query, 'i', $tag);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_GETTING_LOCATION_BY_USER);
            }
            $this->result = $statement->get_result();
            $result_array = array();

            while ($row = mysqli_fetch_assoc($this->result)) {
                $result_array = array('name' => $row['NAME']);
            }

            mysqli_close($this->connection);
            return $result_array;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    function update_parameters($parameters)
    {
        $this->connection = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_DATABASE);

        if ($this->connection) {

//            foreach($parameters as $key => $value){
//                if ($value == ""){
//                    $parameters[$key] = null;
//                }
//            }

            $this->query = "UPDATE wetag_settings SET ADV_RATE = ?, ADVERTISE_IS_HERE = ?, ALARM_TIMING = ?, APN_CODE = ?, APN_NAME = ?, 
                                DISABLE_TIMING = ?, FREEFALL_THD = ?, GEOFENCE_THD = ?, IP_GATEWAY_WIFI = ?, IP_WETAG_WIFI = ?, KA = ?, LND_PRT_TIMING = ?, 
                                MAC_FILTER = ?, MAC_UWB = ?, MD_MODE = ?, NO_MOV_TIMING = ?, POWER_LEVEL = ?, PWD_WIFI = ?, REST_NAME = ?,
                                SCANNING_PKT = ?, SCANNING_RATE = ?, SERVER_IP = ?, SIM_IS_HERE = ?, SSID_WIFI = ?, UDP_PORT_UWB = ?, WIFI_IS_HERE = ?, PERIODIC_SOUND = ?, TACITATION_MODE = ?, LND_PRT_ANGLE = ? WHERE TAG_ID = ?";

            $statement = $this->execute_selecting($this->query, 'iiissiiissiissiiissiisisiiiiii', $parameters['adv_rate'], $parameters['advertise_is_here']
                , $parameters['alarm_timing'], $parameters['apn_code'], $parameters['apn_name'], $parameters['disable_timing'], $parameters['freefall_thd']
                , $parameters['geofence_thd'], $parameters['ip_gateway_wifi'], $parameters['ip_wetag_wifi'], $parameters['ka'], $parameters['lnd_prt_timing'], $parameters['mac_filter']
                , $parameters['mac_uwb'], $parameters['md_mode'], $parameters['no_mov_timing'], $parameters['power_level'], $parameters['pwd_wifi']
                , $parameters['rest_name'], $parameters['scanning_pkt'], $parameters['scanning_rate'], $parameters['server_ip'], $parameters['sim_is_here']
                , $parameters['ssid_wifi'], $parameters['udp_port_uwb'], $parameters['wifi_is_here'], $parameters['periodic_sound'], $parameters['tacitation_mode'], $parameters['lnd_prt_angle'], $parameters['tag_id']);

            if ($statement instanceof db_errors) {
                mysqli_close($this->connection);
                return $statement;
            } else if ($statement == false) {
                mysqli_close($this->connection);
                return new db_errors(db_errors::$ERROR_ON_CHANGING_FIELD);
            }

            $aff_rows = $this->connection->affected_rows;

            mysqli_close($this->connection);

            return $aff_rows;
        }

        return new db_errors(db_errors::$CONNECTION_ERROR);
    }

    /**
     * Function that uses the execute statement to execute a query with the prepare statement
     * @param $query - the query to be executed
     * @param $bind_string - the string containing the types of the parameters of the query
     * @param mixed ...$params - the parameters of the query
     * @return bool|db_errors - the result of the query
     */
    function execute_inserting($query, $bind_string, ...$params)
    {
        $statement = $this->connection->prepare($query);
        $bind_names[] = $bind_string;
        $result = null;

        if ($statement !== false) {

            for ($i = 0; $i < count($params); $i++) {
                $bind_name = 'bind' . $i;
                $$bind_name = $params[$i];
                $bind_names[] = &$$bind_name;
            }

            call_user_func_array(array($statement, 'bind_param'), $bind_names);

            try {
                $result = $statement->execute();
                if ($result == false)
                    return parse_errors($statement->error_list[0]);
            } catch (Exception $e) {
                return new db_errors(db_errors::$ERROR_ON_EXECUTE);
            }

            $statement->close();
        }

        return $result;
    }

    /**
     * Function that uses the execute statement to execute a query with the prepare statement
     * @param $query - the query to be executed
     * @param $bind_string - the string containing the types of the parameters of the query
     * @param mixed ...$params - the parameters of the query
     * @return mysqli_stmt|db_errors
     */
    function execute_selecting($query, $bind_string, ...$params)
    {
        $statement = $this->connection->prepare($query);
        if ($statement !== false) {
            $bind_names[] = $bind_string;

            for ($i = 0; $i < count($params); $i++) {
                $bind_name = 'bind' . $i;
                $$bind_name = $params[$i];
                $bind_names[] = &$$bind_name;
            }

            call_user_func_array(array($statement, 'bind_param'), $bind_names);

            try {
                $statement->execute();
            } catch (Exception $e) {
                return new db_errors(db_errors::$ERROR_ON_EXECUTE);
            }
        }

        return $statement;
    }
}

//$conn = new Connection();
//var_dump($conn->register('dani', 'danin'));