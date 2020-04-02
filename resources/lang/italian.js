languageController.$inject = ['$scope'];

function languageController($scope) {
    $scope.lang = {
        closeButton                     : 'Chiudi',
        ip                              : 'IP',
        buildingName                    : 'Edificio',
        mac                             : 'Mac',
        type                            : 'Tipologia',
        rssi                            : 'Soglia RSSI',
        anchors                         : 'Ancore',
        xPos                            : 'x pos',
        yPos                            : 'y pos',
        zPos                            : 'z pos',
        floor                           : 'Piano',
        radius                          : 'Raggio',
        proximity                       : 'Prossimità',
        permittedAssets                 : 'Permitted assets',
        anchorState                     : 'Stato ancore',
        insertName                      : 'Inserire nome',
        insertXPos                      : 'Inserire coord x',
        insertYPos                      : 'Inserire coord y',
        insertZPos                      : 'Inserire coord z',
        insertFloor                     : 'Inserire piano',
        insertRadius                    : 'Inserire raggio',
        insertIp                        : 'Inserire IP',
        insertProximity                 : 'Inserire prossimità',
        insertType                      : 'Inserire tipologia',
        insertValue                     : 'Inserire valore',
        deleteAnchor                    : 'Cancella ancora',
        noResultFound                   : 'Nessun risultato trovato',
        addAnchor                       : 'Aggiungi ancora',
        activeAllarms                   : 'Allarmi attivi',
        offlineTags                     : 'Wetags offline',
        offlineAnchors                  : 'Ancore offline',
        evacuationState                 : 'Stato evacuazione',
        modifyPageSettings              : 'Modifica impostazioni pagina',
        drawVerticalLine                : 'Disegna linea verticale',
        drawHorizontalLine              : 'Disegna linea orizontale',
        drawInclinedLine                : 'Disegna linea inclinata',
        deleteLine                      : 'Cancella linea',
        changeAnchorPosition            : 'Riposiziona ancora',
        save                            : 'Salva',
        menu                            : 'Menu',
        home                            : 'Pagina principale',
        weTagTable                      : 'Gestione WeTag',
        anchorsTable                    : 'Gestione ancore',
        floorTable                      : 'Gestione piani',
        history                         : 'Storico',
        changePassword                  : 'Cambia password',
        logout                          : 'Logout',
        searchWetag                     : 'Cerca WeTag',
        selectFloor                     : 'Seleziona piano',
        gridSpacing                     : 'Spaziatura griglia',
        grid                            : 'Griglia',
        fullscreen                      : 'Fullscreen',
        cameras                         : 'Telecamere',
        drawingMode                     : 'Modalità disegna',
        oldPassword                     : 'Vecchia password',
        insertOldPassword               : 'Inserire password vecchia',
        newPassword                     : 'Nuova password',
        insertNewPassword               : 'Inserire nuova password',
        reinsertNewPassword             : 'Reinserire nuova password',
        safeAreaPersons                 : 'Persone in area sicura',
        notSafeAreaPersons              : 'Persone non in area sicura',
        floors                          : 'Piani',
        name                            : 'Nome',
        lengthValue                     : 'Lunghezza',
        insertLength                    : 'Inserire lungezza',
        insertSpacing                   : 'Inserire spaziatura',
        selectImage                     : 'Seleziona immagine',
        selectMap                       : 'Seleziona mappa',
        spacing                         : 'Spaziatura',
        addFloor                        : 'Aggiungi piano',
        filter                          : 'Filtro',
        selectDate                      : 'Seleziona data',
        anything                        : 'Qualsiasi',
        date                            : 'Data',
        event                           : 'Evento',
        tag                             : 'WeTag',
        anchor                          : 'Ancora',
        site                            : 'Sito',
        noData                          : 'Nessun dato disponibile',
        sitesTable                      : 'Gestione siti',
        versions                        : 'Versioni',
        onlineAnchors                   : 'Ancore online',
        areOnlineAnchors                : 'Ancore sono online',
        areOfflineAnchors               : 'Ancore sono offline',
        wetagState                      : 'Stato wetags',
        onlineTags                      : 'WeTags online',
        areOnlineTags                   : 'WeTags sono online',
        areOfflineTags                  : 'WeTags sono offline',
        lostTags                        : 'WeTags dispersi',
        areLostTags                     : 'WeTags sono dispersi',
        shutdownTags                    : 'WeTags spenti',
        areShutdownTags                 : 'WeTags sono spenti',
        insertRssi                      : 'Inserire Rssi',
        neighbors                       : 'Vicini',
        searchAnchor                    : 'Cerca ancora...',
        permitted                       : 'WeTag concessi',
        searchTag                       : 'Cerca WeTags...',
        insertAnchor                    : 'Inserire ancora',
        insertingAnchor                 : 'Inserimento ancora',
        insertingFloor                  : 'Inserimento piano',
        insertingSite                   : 'Inserimento sito',
        description                     : 'Descrizione',
        insertDescription               : 'Inserire descrizione',
        latitude                        : 'Latitudine',
        insertLatitude                  : 'Inserire latitudine',
        longitude                       : 'Longitudine',
        insertLongitude                 : 'Inserire longitudine',
        coverInGrades                   : 'Copertura in °',
        coverInMeters                   : 'Copertura in metri',
        isIndoor                        : 'Sito interno',
        insertSite                      : 'Inserire sito',
        insertingMac                    : 'Inserimento MAC',
        insertMac                       : 'Inserire MAC',
        addMac                          : 'Aggiungi MAC',
        nothing                         : 'Nessuno',
        insertingTag                    : 'Inserimento WeTag',
        insertTag                       : 'Inserire WeTag',
        sites                           : 'Siti',
        addSite                         : 'Aggiungi sito',
        username                        : 'Nome utente',
        insertUsername                  : 'Inserire nome utente',
        password                        : 'Password',
        insertPassword                  : 'Inserire password',
        userNotRegisteredOrWrongPassword: 'Utente non registrato o password sbagliata',
        noServerCommunication           : 'Impossibile communicare con il server',
        closedSocket                    : 'Socket chiuso',
        recoverPassword                 : 'Recupera password',
        selectAnchor                    : 'Seleziona ancora',
        batteryLevel                    : 'Batteria',
        wetagType                       : 'Tipologia WeTag',
        tagState                        : 'Stato WeTag',
        addTag                          : 'Aggiungi WeTag',
        macsManaging                    : 'MACs',
        tagNotFound                     : 'Tag non trovato',
        tagNotLoggedUser                : 'Il tag non appartiene all\'user logato!',
        evacuationZonePersons           : 'Persone in zona di evacuazione',
        disapearedPersons               : 'Persone disperse',
        deleteSite                      : 'Cancella sito',
        okDeleteSite                    : 'Sei sicuro di voler cancellare il sito?',
        cancel                          : 'Annulla',
        passwordDontMatch               : 'Le password devono coincidere!',
        invalidOld                      : 'Password precedente non valida',
        impossibleChangePassword        : 'Impossibile cambiare la password!',
        passwordChanged                 : 'Password cambiata correnttamente!',
        deleteMac                       : 'Cancellazione MAC',
        okDeleteMac                     : 'Sei sicuro di voler cancellare il MAC?.',
        impossibleInsertFloor           : 'Impossibile inserire il piano.',
        floorInsertedWithoutImage       : 'Piano inserito senza salvare l\'immagine',
        floorInserted                   : 'Piano inserito con successo',
        tagNotInitialized               : 'Il tag e\' stato censito ma non e\' mai stato localizzato!',
        enabledTags                     : 'WeTags attivati',
        disabledAnchors                 : 'Ancore disabilitate',
        enabledAnchors                  : 'Ancore attive',
		from                            : 'Dal',
        to                              : 'al',
        eventType                       : 'Tipo evento',
        version                         : 'Versione',
        drawZone: 'Disegna zona',
        deleteZone: 'Cancella zona',
        modifyZone: 'Modifica zona',
        zoneTable: 'Gestione zone',
        zone: 'Zone',
        quickActions: 'Comandi rapidi',
        selectGridSpacing: 'Seleziona la spaziatura della griglia',
        draw: 'Disegna',
        showHideDraw: 'Mostra/nascondi strumenti di disegno',
        showHideFullscreen: 'Mostra/nascondi schermo intero',
        lostPersons: 'Persone disperse',
        userManager: 'Gestione utenti',
        location: 'Sito',
        locations: 'Siti',
        openSite: 'Apri sito',
        insertLocation: 'Inserire sito',
        email: 'Email',
        insertEmail: 'Inserire una email',
        insertValidEmail: 'Inserire una email valida',
        emailNotRegistered: 'Email non registrata',
        recoverPasswordText: 'Ti verrà inviato un codice di verifica all\'inidrizzo email inserito. L\'indirizzo email deve essere associato ad un account Smart Studio!',
        code: 'Codice',
        insertCode: 'Inserire codice ricevuto via email',
    	confirmPassword: 'Conferma password',
    	reinsertPassword    : 'Inserire nuovamente la password',
    	resetPassword       : 'Reseta password',
    	xLeft               : 'X left',
    	xRight              : 'X right',
    	yUp                 : 'Y up',
    	yDown               : 'Y down',
    	insertColor         : 'Inserire colore',
        searchLocation      : 'Cerca sito',
        shutDownAnchors     : 'Ancore scariche',
        areShutDownAnchors  : 'Ancore sono spente',
        online              : 'Online',
        offline             : 'Offline',
        batteryStatus       : 'Stato batteria',
        tagType             : 'Tipo tag',
        tagAlarms           : 'Allarmi Wetag',
        tagsAlarms          : 'Allarmi Wetags',
        audio               : 'Audio',
        zones               : 'Zone',
        outLocationTags     : 'Fuori sito',
        showOutdoorTagsLabel: 'Squadre',
        showTableSorting    : 'Ordina',
        deleteHistory       : 'Cancella storico',
        wetagsGroup         : 'Gruppi Wetag',
        adminUser           : 'Amministratore',
        intermediateUser    : 'Intermedio',
        genericUser         : 'Generico',
        trackerUser         : 'Tracciamento',
        zonesManaging       : 'Zone',
        insertZone          : 'Inserisci zona',
        insertZoneName      : 'Nome zona',
        insertZoneXLeft     : 'X angolo alto sinistra',
        insertZoneXRight    : 'X angolo basso destra',
        insertZoneYUp       : 'Y angolo alto sinistra',
        insertZoneYDown     : 'Y angolo basso destra',
        insertZoneRadius    : 'Raggio',
        insertZoneColor     : 'Seleziona colore',
        noZoneAvailable     : 'Nessuna zona disponibile',
        engineOff           : 'Server spento',
        outdoorRectDrawing  : 'Quadrato',
        outdoorRoundDrawing : 'Cerchio',
        xCenter             : 'Centro x',
        yCenter: 'Centro y',
        color: 'Colore',
        saveConfiguration: 'Salva configurazione',
        manageLocation: 'Gestione siti',
        muteAlarm: 'Silenzia allarmi',
        silentiating: 'Silenzio allarmi ...',
        insertUser: 'Inserimento utente',
        parameters: 'parametri',
        advertisementRate: 'Advertisement',
        powerLevel: 'Livello potenza', 
        disableTiming: 'Tempo disabilitazione',
        alarmTiming: 'Tempo pre-allarme',
        noMovTiming: 'Tempo asssenza movimento',
        manDownMode: 'Modalità uomo a terra',
        keepAliveTimer: 'Keep Alive',
        scanningTimer: 'Tempo scansione',
        lndPrtTimer: "Tempo LND/PRT",
        scanningBeacons: 'Pkt scansione',
        freefallRate: 'Altezza caduta',
        simOn: 'Sim presente',
        wifiOn: 'WiFi presente',
        advSatOn: 'Adv/Sat presente',
        macFilter: 'Filtro mac',
        apnOperator: 'Operatore APN',
        apnCode: 'Codice APN',
        restName: 'Nome REST',
        serverIp: 'IP server',
        ssidWiFi: 'WiFi SSID',
        pwdWiFi: 'WiFi Password',
        ipGatewayWiFi: 'IP Gateway WiFi',
        ipWetagWiFi: 'IP WeTAG WiFi',
        geofenceThd: 'Geofence thd',
        macUwb: 'Mac UWB',
        geofencePort: 'Porta UDP UWB',
        openMenu: 'Apri menu',
        phoneNumber: 'Numero di telefono',
        addEmail: 'Aggiungi email',
        insertBootUrl: 'Inserisci l\'url del boot',
        insertChatId: 'Inserisci l\'id dellla chat',
        insertWebUrl: 'Inserisci l\'url del web',
        sddLocation: 'Aggiungi sito',
        deleteLocation: 'Cancella sito',
        addZone: 'Aggiungi zona',
        deleteUser: 'Cancella utente',
        centerMap: 'Centra mappa',
        role: 'Ruolo',
        phone: 'Telefono',
        urlBot: 'URL Bot',
        botId: 'ID Bot',
        emailAlert: 'Email di allerta',
        webserviceUrl: 'URL del webservice',
        legend: 'Legenda',
        image: 'Imagine',
        meaning: 'Significato',
        safe_tag_meaning: 'WeTAG in stato sicuro',
        safe_tag_description: 'Nessun allarme generato',
        safe_tags_meaning: 'Gruppi di WeTAG in stato sicuro',
        safe_tags_description: 'Due o più WeTAG con la stessa posizione. Nessun allarme generato',
        alarm_tag_meaning: 'WeTAG in allarme',
        alarm_tag_description: 'Uomo a terra involontario',
        sos_tag_meaning: 'WeTAG in allarme',
        sos_tag_description: 'Uomo a terra volontario',
        low_battery_tag_meaning: 'WeTAG in allarme',
        low_battery_tag_description: 'Batteria in esaurimento',
        out_location_tag_meaning: 'WeTAG in avviso',
        out_location_tag_description: 'Fuori da una Location',
        men_down_tacited_tag_meaning: 'WeTAG in avviso',
        men_down_tacited_tag_description: 'Tacitazione pre allarme uomo a terra',
        men_down_disabled_tag_meaning: 'WeTAG in aviso',
        men_down_disabled_tag_description: 'Rilevazione uomo a terra disabilitata temporaneamente',
        prohibited_tag_zone_tag_meaning: 'WeTAG  in avviso',
        prohibited_tag_zone_tag_description: 'All’interno di una zona vietata',
        quote_change_tag_meaning: 'WeTAG in avviso',
        quote_change_tag_description: 'Cambiamento di quota',
        not_dpi_glove_tag_meaning: 'WeTAG in avviso',
        not_dpi_glove_tag_description: 'Assenza di DPI guanto',
        not_dpi_helmet_tag_meaning: 'WeTAG in avviso',
        not_dpi_helmet_tag_description: 'Assenza di DPI casco',
        not_dpi_belt_tag_meaning: 'WeTAG in avviso',
        not_dpi_belt_tag_description: 'Assenza di DPI cintura',
        not_dpi_mask_tag_meaning: 'WeTAG in avviso',
        not_dpi_mask_tag_description: 'Assenza di DPI maschera',
        mixt_tags_safe_alarm_meaning: 'Gruppi di WeTAG',
        mixt_tags_safe_alarm_description: 'Due o più WeTAG con la stessa posizione. Uno o più WeTAG in stato sicuro e uno o più WeTAG in allarme',
        lost_tag_meaning: 'WeTAG offline o disperso',
        lost_tag_description: 'Ultimo keep alive (k.a.) ricevuto oltre il timeout',
        mixt_tags_safe_lost_meaning: 'Gruppi di WeTAG',
        mixt_tags_safe_lost_description: 'Due o più WeTAG con la stessa posizione. Uno o più WeTAG in stato sicuro e uno o più WeTAG offline o dispersi',
        mixt_tags_lost_alarm_meaning: 'Gruppi di WeTAG',
        mixt_tags_lost_alarm_description: 'Due o più WeTAG con la stessa posizione..Uno o più WeTAG in allarme e uno o più WeTAG offline o dispersi',
        mixt_tags_all_meaning: 'Gruppi di WeTAG',
        mixt_tags_all_description: 'Due o più WeTAG con la stessa posizione. Uno o più WeTAG in allarme, uno o più WeTAG offline o dispersi, uno o più WeTAG in stato sicuro.',
        lost_tags_meaning: 'Gruppi di WeTAG',
        lost_tags_description: 'Due o più WeTAG con la stessa posizione. Offline o dispersi',
        alarm_tags_meaning: 'Gruppi di WeTAG',
        alarm_tags_description: 'Due o più WeTAG con la stessa posizione. In allarme',
        online_anchor_meaning: 'Ancora online',
        online_anchor_description: 'Connessa alla rete o con batteria carica',
        offline_anchor_meaning: 'Ancora offline',
        offline_anchor_description: 'Non connessa alla rete o con batteria scarica',
        indoor_location_meaning: 'Location indoor',
        indoor_location_description: 'Non sono stati localizzati eventi allarme',
        outdoor_location_meaning: 'Location outdoor',
        outdoor_location_description: 'Non sono stati localizzati eventi allarme',
        alarm_symbol_meaning: 'Location indoor o outdoor',
        alarm_symbol_description: 'Sono stati localizzati eventi allarme WeTAG',
        anchor_alarm_symbol_meaning: 'Location indoor o outdoor',
        anchor_alarm_symbol_description: 'Sono stati localizzati eventi allarme Ancore',
        engine_alarm_meaning: 'Possibilità di malfunzionamento',
        engine_alarm_description: 'Allarmistica utente (Email – Telegram – SMS - Chiamate) o di Location Engine',
        wetag_alarm_meanig: 'Avvisi WeTAG',
        wetag_alarm_description: 'Possibile malfunzionamento WeTAG (dispersi o offline)',
        alarm_tags_home_meaning: 'blalblaljb',
        alarm_tags_home_description: 'dkajshfkahfiuafdshi',
        loopSound: 'Suono perpetuo',
        tacitation_mode: 'Tacitazione',
        time: 'Tempo ultimo ka indoor',
        gpsTime: 'Tempo ultimo ka outdoor',
        alarmTime: 'Tempo ultimo evento',
        lnd_prt_angle: 'LND/PRT Angolo',
        tagCategory: 'Gestione categorie tag',
        addTagCategory: 'Aggiungi categoria tag',
        tagCategories: 'Categorie tag',
        insertingTagCategory: 'Inserimento categoria tag',
        insertTagCategory: 'Inserisci categoria tag',
        alertImage: 'Immagine allarme',
        noAlertImage: 'Immagine no allarme',
        deleteCategory: 'Cancella Categoria',
        categoryTags: 'Tag per categorie',
        selectTags: 'Seleziona tags',
        safetyBox: 'Gestione safety box',
        safetyBoxTable      : 'Safety box',
        imei                : 'Imei',
        insertImei          : 'Inserire imei',
        addSafetyBox        : 'Aggiungi safety box',
        deleteSafetyBox     : 'Cancella safety box',
        deleteSafetyBoxText : 'Sei sicuro di voler cancellare la safety box?',
        insertSafetyBoxTitle: 'Inserimento safety box',
        insertSafetyBox     : 'Inserire safety box',
        saveHistory         : 'Salva storico',
        protocol            : 'Protocollo',
        beaconType          : 'Tipo beacon',
        tracking            : 'Tracking',
        trackingTable       : 'Tabella tracking',
        priority            : "Priorita",
        headerOrder         : 'Ordine header',
        headerLeftSide      : 'Header a sinistra',
        openLegend          : 'Legenda',
        categoryLegend      : 'Legenda categorie',
        manDownCause        : 'Causa uomo a terra',
        anchorMac           : 'MAC anchora',
        userTableTitle      : 'Utenti',
        standByMode         : 'Standby Mode'
    }
}

let lang = {
    sos             : 'SOS',
    helpRequest     : 'Richiesta di aiuto.',
    manDown         : 'Uomo a terra',
    batteryEmpty    : 'Batteria scarica',
    helmetDpi       : 'Dpi casco',
    beltDpi         : 'Dpi cintura',
    gloveDpi        : 'Dpi guanti',
    shoeDpi         : 'Dpi scarpe',
    manDownDisabled : 'Uomo a terra disabilitato',
    manDownTacitated: 'Uomo a terra silenziato',
    manInQuote      : 'Uomo sospeso',
    callMeAllarm    : 'Allarme chiamata',
    changePassword: 'Cambio password',
    passwordNotEqual: 'Le password devono coincidere',
    oldPasswordNotValid: 'Vecchia password non valida',
    tagOutSite: 'Fuori sito',
    personInEvacuationZone: 'Persone in zona di evacuazione',
    lostPersons: 'Persone disperse',
    insertValue: 'Inserire valore',
    positionInsertedWithoutImage    : 'Posizione inserita senza salvare l\'immagine',
    impossibleToInsertPosition      : 'Impossibile inserire la posizione.',
    positionInserted                : 'Posizione inserita con successo',
    cancelUser: 'Cancela utente',
    cancelUserText: 'Sei sicuro di voler cancellare l\'utente?',
    cancel: 'Anulla',
    userInserted: 'Utente inserito con successo',
    canInsertUser: 'Impossibile inserire l\'utente',
    users: 'Utenti',
    deleteLocation: 'Cancella sito', 
    deleteLocationText: 'Sei sicuro di voler cancellare la location?',
    deleteZone: 'Cancella zona',
    deleteZoneText: 'Sei sicuro di voler cancellare la zona?',
    genericUser: {userName: 'Utente generico', userValue: 0},
    intermediateUser: {userName: 'Utente intermedio', userValue: 2},
    trackerUser: {userName: 'Utente di tracciamento', userValue: 3},
    invalidOld: 'Password vecchia non valida',
    impossibleChangePassword: 'Impossibile cambiare la password',
    passwordChanged: 'Password cambiata',
    dkDeleteTag: 'Sei sicuro di voler cancellare il tag?',
    deleteMac: 'Cancella mac',
    okDeleteMac: 'Sei sicuro di voler cancellare il mac?',
    okDeleteZone: 'Sei sicuro di voler cancellare la zona?',
    shutDownTags                    : 'WeTags spenti',
    activeTags: 'WeTag attivi',
    disabledTags                    : 'WeTags disabilitati',
    lostTags                        : 'WeTags dispersi/offline',
	deleteSite                      : 'Cancella sito',
    okDeleteSite                    : 'Sei sicuro di voler cancellare il sito?',
    deleteTag                       : 'Cancella WeTag',
    okDeleteTag                     : 'Sei sicuro di voler cancellare l\'WeTag?',
	deleteAnchor                  : 'Cancella ancora',
	okDeleteAnchor                  : 'Sei sicuro di voler cancellare l\'ancora?.',
	deleteFloor                     : 'Cancellazione piano',
    okDeleteFloor                   : 'Sei sicuro di voler cancellare il piano?',
    selectFloorFile                 : 'Seleziona un\'immagine per il piano',
    tagNotFound                     : 'Tag non trovato',
	tagNotLocation                : 'Il tag non appartiene a nessuna location!',
    noLocation: 'Nessuna location',
    noValidPosition: 'Posizione non valida',
    noValidPositionDescription: 'Il tag non ha coordinate gps valide',
    insideZone: 'Tag in zona vietata',
    unableToSaveData: 'Impossibile salvare i dati',
    dataSavedSuccessfully: 'I dati sono stati salvati correttamente',
    dataSaved: 'Dati salvati',
    actionCanceled: 'Operazione cancellata',
    noPosition: 'Nessuna posizione',
    outOfSite: 'Tag fouri sito',
    outOfSiteDescription: 'Il tag e\' fuori da tutti i siti',
    drawingSaved: 'Disegno salvato',
    drawingNotSaved: 'Disegno non salvato',
    tagCategorySelectImage: 'Selezionare le immagini per la categoria',
    cannotConvertImage: 'Impossibile comprimere l\'imagine per la transmissione',
    cannotSaveImage: 'Impossibile salvare immagine',
    deleteCategory: 'Cancella Categoria',
    deleteSafetyBox: 'Cancella safety box',
    deleteSafetyBoxText: 'Sei sicuro di voler cancellare la safety box?',
    initEvacuation: 'Inizia evacuazione',
    reset: 'Riprisina',
    callMe: 'Chiamami',
    stopCallMe: 'Tacitami',
    disabledAnchors               : 'Ancore disabilitate',
    enabledAnchors                : 'Ancore attive',
    shutDownAnchors               : 'Ancore scariche',
    entering                      : 'Attendere prego ....',
    locationNotSaved              : 'Impossibile salvare location',
    zoneFloorUpdated              :'Zona aggiornata',
    zoneFloorDeleted              :'Zona cancellata',
    zoneFloorNotUpdated           :'Impossibile aggiornare la zona',
    zoneFloorNotDeleted           :'Impossibile cancellare la zona',
    headerZonesNotSetted          : 'Impossibile settare le zone nel header',
    invalidAutomation             : 'Automazione invalida',
    impossibleRecoverTagCategories: 'Impossibile recuperare le caegorie dei tag',
    noCause                       : 'No cause',
    freefall                      : 'Freefall',
    lndPrt                        : 'LND/PRT',
    noMov                         : 'No mov',
    ble                           : 'BLE',
    wifi                          : 'WIFI',
    gprs                          : 'GPRS',
    safetyBox                     : 'Safety Box',
    elementDeleted                : 'Elemento cancelato',
    elementNotDeleted             : 'Elemento non cancellato',
    impossibleDeleteLocation      : 'Impossibile cancellare la locazione',
    fieldChanged                  : 'Campo modificato',
    fieldNotChanged               : 'Campo non modificato',
    login                         : 'Login',
    tagOff                        : 'Tag spento!',
    elementInserted               : 'Elemento inserito',
    elementNotInserted            : 'Elemento non inserito',
    userDeleted                   : 'Utente cancelato',
    userNotDeleted                : 'Utente non cancellato',
    columns                       : 'Colonne',
    locations                     : 'Siti',
    openSite                      : 'Apri sito',
    tags                          : 'Tag',
    anchors                       : 'Ancore',
    latitude                      : 'Latitudine',
    longitude                     : 'Longitudine'
};