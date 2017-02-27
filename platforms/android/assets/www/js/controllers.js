app.controller('AppCtrl', function($scope, $ionicSideMenuDelegate, $rootScope, $ionicModal, $timeout, ngFB, DB) {
  $rootScope.toggleLeftSideMenu = function() {
    $ionicSideMenuDelegate.toggleLeft();
  };

  

  $rootScope.fbLogin = function () {
    console.log("login facebook...");
    ngFB.login({scope: 'email,public_profile'}).then(
      function (response) {
        if (response.status === 'connected') {
          console.log('Facebook login succeeded');
          $rootScope.fbAccessToken = response.authResponse.accessToken;
          getLongLivedToken($rootScope.fbAccessToken);
          getMyFacebookInfo();
        } else {
          alert('Facebook login failed');
        }
      },function(error){
      	console.log(error);
      });
  };
  
  $rootScope.fbLogout = function () {
    console.log("logging out facebook...");
    ngFB.logout().then(
      function (response) {
    	ngFB.updateAccessToken(null);
      	$rootScope.fbAccessToken = null;
        window.localStorage.setItem("fbToken", null);
        $rootScope.updateFbStatus();
      },function(error){
      	console.log("error logout:"+ error);
      });
  };

  $rootScope.updateFbStatus = function(){
    ngFB.getLoginStatus().then(function(result){
      console.log("facebook login status:");
      console.log(result);
      if(result.status === 'connected' && result.authResponse.accessToken != "null"){
        $rootScope.fbAccessToken = result.authResponse.accessToken;
        getLongLivedToken($rootScope.fbAccessToken);
        getMyFacebookInfo();
      }else
          $scope.fbUser = null;
    });
  };


  function getMyFacebookInfo(){
    ngFB.api({
      path: '/me',
      params: {fields: 'id,name'}
    }).then(
      function (user) {
        $timeout(function() {
          $scope.fbUser = user;
          console.log(user);
        })
      },
      function (error) {
        console.log('Facebook error: ' + error.error_description);
          $scope.fbUser = null;
      });
      
      
  }
  
  function getLongLivedToken(shortLivedToken){
    console.log("Getting long lived facebook token");
    DB.getFacebookLongLivedToken(shortLivedToken).then(
    	function(response){
    		console.log("long lived token:");
        	$rootScope.fbAccessToken = getParameterByName('access_token', '?'+response.data);
    		console.log($rootScope.fbAccessToken);
    		//saves token in device and in session storage  		
        	window.localStorage.setItem("fbToken", $rootScope.fbAccessToken);
    		ngFB.updateAccessToken($rootScope.fbAccessToken);
    	}
    );   
    
	
	function getParameterByName(name, url) {
    if (!url) {
      url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}
  }


	$rootScope.fbAccessToken = null;
	//if there is a facebook token saved in the device, use it 
	if(localStorage.getItem("fbToken") != null){
    	ngFB.updateAccessToken(localStorage.getItem("fbToken"));
	 	getMyFacebookInfo();
	
	}else $scope.fbUser = null;
  	$rootScope.updateFbStatus();



});

app.controller('MapCtrl', function($scope, $state, $cordovaGeolocation, $timeout, $sce, DB, $ionicLoading, $ionicModal, $ionicPopup, ngFB, $rootScope, $ionicSlideBoxDelegate) {


  //global variables
  $scope.places = [];
  $scope.currentPlace = {};
  $scope.currentReport = {};
  $scope.currentPlace.name = "Nome teste";
  $scope.currentPlace.vicinity = "endereco";
  $scope.currentPlace.distance = "00 km";
  $scope.currentPlace.category = "Bar";
  $scope.currentPlace.photo = "img/no-photo.jpg";
  $scope.currentReport.status = 4;
  $scope.firstLoad = true;
  $scope.zindex = 1;
  $ionicModal.fromTemplateUrl('templates/thermometer.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.thermometerModal = modal;
  });

  //get current location
  var geoOptions = {timeout: 30000, enableHighAccuracy: false};
  var watch = $cordovaGeolocation.watchPosition(geoOptions);
  watch.then(null,
    function(error){ alert("Could not get location");  },
    function(position) {
      console.log("position changed or time passed");
      $scope.myPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      console.log($scope.myPosition.lat() + ' ' + $scope.myPosition.lng());
      if ($scope.firstLoad) {
        initializeMap(position);
        $ionicLoading.show({
          animation: 'fade-in',
          showBackdrop: true,
          maxWidth: 200,
          showDelay: 0,
          template: '<ion-spinner icon="ripple" class="spinner-calm"></ion-spinner>' +
          '<br/>Procurando...'
        });
        addMyPositionMarker(position);
        $scope.lastPosition = position;

      } else {
        updateMyPosition($scope.myPositionMarker, $scope.myPosition);
      }

      if ($scope.firstLoad || getDistanceFromLatLonInKm(position, $scope.lastPosition, true) > 0.2) {
        searchNearByPlaces();
      }
      if(!$scope.firstLoad) updateStatusMarkers();
      $scope.lastPosition = position;
    });



  /* Map functions */

  function getDistanceFromLatLonInKm(pos1,pos2, geo) {
    if(geo){
      var lat1 = pos1.coords.latitude ;
      var lon1 = pos1.coords.longitude ;

      var lat2 = pos2.coords.latitude;
      var lon2 = pos2.coords.longitude;

    }else{
      var lat1 =  pos1.lat();
      var lon1 =  pos1.lng();

      var lat2 = pos2.lat();
      var lon2 = pos2.lng();

    }

    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1);
    var a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
      ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    return d;
  }

  function deg2rad(deg) {
    return deg * (Math.PI/180)
  }

  function initializeMap() {

    //style of the map (https://snazzymaps.com/style/18/retro)
    var mapStyle = [
      {
        "featureType": "landscape",
        "elementType": "all",
        "stylers": [
          {
            "hue": "#6600ff"
          },
          {
            "saturation": -11
          }
        ]
      },
      {
        "featureType": "poi",
        "elementType": "all",
        "stylers": [
          {
            "saturation": -78
          },
          {
            "hue": "#6600ff"
          },
          {
            "lightness": "10"
          },
          {
            "visibility": "on"
          }
        ]
      },
      {
        "featureType": "road",
        "elementType": "all",
        "stylers": [
          {
            "hue": "#5e00ff"
          },
          {
            "saturation": -79
          }
        ]
      },
      {
        "featureType": "road.local",
        "elementType": "all",
        "stylers": [
          {
            "lightness": 30
          },
          {
            "weight": 1.3
          }
        ]
      },
      {
        "featureType": "transit",
        "elementType": "all",
        "stylers": [
          {
            "visibility": "simplified"
          },
          {
            "hue": "#5e00ff"
          },
          {
            "saturation": -16
          }
        ]
      },
      {
        "featureType": "transit.line",
        "elementType": "all",
        "stylers": [
          {
            "saturation": -72
          }
        ]
      },
      {
        "featureType": "water",
        "elementType": "all",
        "stylers": [
          {
            "saturation": -65
          },
          {
            "hue": "#1900ff"
          },
          {
            "lightness": 8
          }
        ]
      }
    ];

    //map options
    var mapOptions = {
      center: $scope.myPosition,
      zoom: 17,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: mapStyle,
      disableDefaultUI: true,
      clickableIcons: false
    };

    //initialize map
    $scope.map = new google.maps.Map(document.getElementById("map"), mapOptions);
  }
  
  function addMyPositionMarker(){

    //Wait until the map is loaded
    google.maps.event.addListenerOnce($scope.map, 'idle', function(){

      $scope.myPositionMarker = new google.maps.Marker({
        map: $scope.map,
        position: $scope.myPosition,
        icon: 'img/me.png'
      });

      google.maps.event.addListener($scope.myPositionMarker, 'click', function () {
      });

    });
  }

  function updateMyPosition(marker, position) {
    marker.setPosition(position);
  }

  function searchNearByPlaces(){
    //set filters
    var request = {
      location: $scope.myPosition,
      //radius: '5000',
      types: ['bar', 'night_club'],
      rankBy: google.maps.places.RankBy.DISTANCE,
      openNow: true
    };

    //set service
    $scope.placeService = new google.maps.places.PlacesService($scope.map);
    //trigger the search
    $scope.placeService.nearbySearch(request, addPlacesOnMap);
  }

  function addPlacesOnMap(results, status){
    if (status == google.maps.places.PlacesServiceStatus.OK) {
      //clear the places array and update it
      clearAllMarkers();
      $scope.places = [];
      $scope.places = results;

      for (var i = 0; i < results.length; i++) {
        //for each place found, create marker
        var place = results[i];
        //get status and add marker
        getPlaceExtraInfo(place, i);
        console.log(place);


        //if user is close to place, suggest colaboration
        if(getDistanceFromLatLonInKm($scope.myPosition, place.geometry.location, false) < 0.05 && !$scope.firstLoad){
          showNearConfirm(place.name, i);
        }

        //TODO dont increase id when INSERT IGNORE
        var newPlace = {};
        newPlace.place_id = place.place_id;
        newPlace.address = place.vicinity;
        newPlace.name = place.name;
        newPlace.lat = place.geometry.location.lat();
        newPlace.long = place.geometry.location.lng();
        newPlace.type = place.types[0] + " " + place.types[1] + " " + place.types[2];


        DB.savePlaceIfNotExists(newPlace).then(function(result) {
          $ionicLoading.hide();
        });



      }
    }else alert("Erro ao encontrar locais:"+ status);
  }

  //clear all place markers
  function clearAllMarkers(){
    console.log('clearing markers');
    $scope.places.forEach(function(item, index){
      console.log($scope.places[index]);
      if(typeof item.marker != "undefined")
        $timeout(function(){
          item.marker.setMap(null);
        }, 1500);
    });
  }
  
  //get places Backand infos and add marker
  function getPlaceExtraInfo(place, index){
    DB.getPlaceByPlaceId(place.place_id).then(function(result){
      $scope.places[index].status = result.data[0].status;
      $scope.places[index].lastreport = result.data[0].lastreport;
      //TODO add more details
      addPlaceMarker(place, index);
    });
  }

  function addPlaceMarker(place, index){
    var status = getThermometerMark($scope.places[index].status, $scope.places[index].lastreport);
    //Wait until the map is loaded
    google.maps.event.addListenerOnce($scope.map, 'idle', function(){

      var animation;
      if($scope.firstLoad == true)
        animation = google.maps.Animation.DROP;
      else animation = null;

      $scope.places[index].marker = new google.maps.Marker({
        map: $scope.map,
        animation: animation,
        position: place.geometry.location,
        zIndex: $scope.zindex,
        icon: 'img/thermometer/'+status+'.png'
      });

      google.maps.event.addListener($scope.places[index].marker, 'click', function () {
        $scope.closePlace(index);
        setCurrentPlace(index);
        $timeout(function(){$scope.openPlace(index)}, 300);
        $scope.map.panTo($scope.currentPlace.geometry.location);

      });

      $scope.firstLoad = false;

    });


  }

  function toggleBounce(index) {
    if ( $scope.places[index].marker.getAnimation() !== null) {
      $scope.places[index].marker.setAnimation(null);
    } else {
      $scope.places[index].marker.setAnimation(google.maps.Animation.BOUNCE);
    }
  }

  function getThermometerMark(status, lastreport){
    if(getDateInterval(lastreport) > 3 ) return 0; //if lastreport was earlier than 3 hrs ago, ignore
    if(status == 0 || status == null) return 0;
    if(status < 1.5) return 1;
    if(status >= 1.5 && status < 2.5) return 2;
    if(status >= 2.5 && status < 3.5) return 3;
    if(status >= 3.5 && status < 4.5) return 4;
    if(status >= 4.5 && status < 5.5) return 5;
    if(status >= 5.5 && status < 6.5) return 6;
    if(status >= 6.5 && status < 7.5) return 7;
    if(status >= 7.5 && status < 8.5) return 8;
    if(status >= 8.5 && status < 9.5) return 9;
    if(status >= 9.5) return 10;
  }

  function setCurrentPlace(index){
    $scope.currentPlace = $scope.places[index];

    //set current place main photo
    if(typeof $scope.currentPlace.photos != 'undefined')
      $scope.currentPlace.photo = $sce.trustAsResourceUrl($scope.currentPlace.photos[0].getUrl({'maxWidth': 300, 'maxHeight': 300}));
    else
      $scope.currentPlace.photo = "img/no-photo.jpg";

    //set image of category
    //TODO add restaurant category
    if($scope.currentPlace.types.includes('night_club') && $scope.currentPlace.types.includes('bar'))
      $scope.currentPlace.category = "Bar Balada";
    else if($scope.currentPlace.types.includes('night_club'))
      $scope.currentPlace.category = "Balada";
    else if($scope.currentPlace.types.includes('bar'))
      $scope.currentPlace.category = "Bar";

    //calculate distance from my position
    calcDistance($scope.myPosition, $scope.currentPlace.geometry.location);

    $timeout(function() {
      $scope.$apply();
    });

  }

  function calcDistance(origin, destiny){
    var service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destiny],
        travelMode: google.maps.TravelMode.WALKING
      }, callbackDistance);

    function callbackDistance(response, status) {
      if (status == google.maps.DistanceMatrixStatus.OK) {
        var origins = response.originAddresses;

        for (var i = 0; i < origins.length; i++) {
          var results = response.rows[i].elements;
          for (var j = 0; j < results.length; j++) {
            var element = results[j];
            $scope.currentPlace.distance = element.distance.text;
          }
        }
      }
    }
  }

  function getPlaceDetails(place_id){
    $scope.hideSpinner = false;
    $scope.noPhotos = false;
    var request = {
      placeId: place_id
    };

    var service = new google.maps.places.PlacesService($scope.map);
    service.getDetails(request,
      function callback(place, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          console.log("Google Details:");
          console.log(place);
          $scope.currentPlace.allPhotos = place.photos;
          if(typeof place.photos == "undefined") {
            $scope.noPhotos = true;
          }
          $scope.currentPlace.website = place.website;

          DB.getPlaceByPlaceId(place.place_id).then(function(result){
            var dbPlace = result.data[0];
            console.log("DB details: ");
            console.log(dbPlace);
            if(dbPlace.facebook == null && $rootScope.fbAccessToken != null){
              getFacebookPlace(place, function(fbPlace){

                if(fbPlace == false){
                  $scope.currentPlace.description = dbPlace.description == null ? "Sem descrição" : dbPlace.description ;
                  $scope.currentPlace.price = dbPlace.price == null ? "?" : dbPlace.price;
                  $scope.hideSpinner = true;
                  return;
                }
                console.log("FB details: ");
                console.log(fbPlace);
                $scope.currentPlace.description = fbPlace.about != null ? fbPlace.about : fbPlace.description;
                $scope.currentPlace.facebook = fbPlace.link;
                $scope.currentPlace.facebook_id = fbPlace.id;

                $scope.currentPlace.price = fbPlace.price_range == null ? "?" : fbPlace.price_range;
                if(place.website == null){
                  if(fbPlace.website != null)
                    $scope.currentPlace.website = fbPlace.website;
                  else
                    $scope.currentPlace.website = fbPlace.link;
                }

                $scope.hideSpinner = true;

                DB.updatePlace($scope.currentPlace.place_id, $scope.currentPlace).then(function(){
                  console.log("Facebook details saved in database");
                });
              });
            }else{
              $scope.currentPlace.description = dbPlace.description == null ? "Sem descrição" : dbPlace.description ;
              $scope.currentPlace.facebook = dbPlace.facebook;
              $scope.currentPlace.price = dbPlace.price;
              $scope.hideSpinner = true;
            }
          });

        }else alert(status);
      });
  }

  function getFacebookPlace(place, callback){
    //search for page of place in facebook
    var rightPlace = {};
    ngFB.api({
      path: '/search',
      params: {
        q: place.name,
        type: "page",
        access_token: $rootScope.fbAccessToken,
        fields: 'description,about,cover,link,place_type,price_range,location,name,website'
      }
    }).then(
      function (pages) {
        var found = false;
        for(var i = 0; i < pages.data.length ; i++){
          /* if the place has almost the same coordinates */
          if(pages.data[i].place_type == "PLACE" &&
            Math.floor(pages.data[i].location.latitude*1000)/1000 == Math.floor(place.geometry.location.lat()*1000)/1000 &&
            Math.floor(pages.data[i].location.longitude*1000)/1000 == Math.floor(place.geometry.location.lng()*1000)/1000){

              console.log('found ' +pages.data[i].name );
              found = true;
              rightPlace = pages.data[i];
              console.log(rightPlace);
              callback(rightPlace);

          }
        }

        if(!found) callback(false);
      },
      function (error) {
        console.log('Facebook error: ' + error.error_description);
        callback(false);
      });
  }


  function getFacebookEvents(page_id, callback){
    ngFB.api({
      path: '/' + page_id + '/events',
      params: {
        fields: 'cover,attending_count,interested_count,name,description,is_page_owned,start_time,type,ticket_uri',
        since: Math.floor(Date.now() / 1000) - (60*60*24), //since yesterday
        access_token: $rootScope.fbAccessToken
      }
    }).then(
      function (response) {
        if(response.data.length == 0) {
          showAlert("Oops :(", "Não há eventos desse local no Facebook...", "OK");
          return;
        }
        var events = response.data;
        console.log(events);
        for(var i=0; i < events.length; i++){
          var event = events[i];
          var date = mysqlTimeStampToDate(event.start_time.replace('T', ' ').substring(0,19));
          var dia= pad(date.getDate(),2);
          var mes= pad(date.getMonth() + 1,2);
          var ano=date.getFullYear();
          var hora= pad(date.getHours(),2);
          var minutos = pad(date.getMinutes(),2) ;
          var dias = ["Dom", "Seg","Ter", "Qua", "Qui", "Sex", "Sáb"];
          if((new Date()).toDateString() == date.toDateString())
            event.formatDate = "Hoje às " + hora + ':' + minutos;
          else
            event.formatDate = dia + '/' + mes + '/' + ano + ' (' +  dias[date.getDay()]+ ') às ' + hora + ':' + minutos;
          event.descrOpen = false;
        }
        $scope.currentPlace.events = events;
        $scope.showEventsModal();
      },
      function (error) {
        showAlert("Oops :(", "Não encontramos eventos desse local no Facebook...", "OK");
        console.log('Facebook error: ' + error.error_description);
      });
  }

  function saveThermometerReport(){
    $scope.currentReport.place_id = $scope.currentPlace.place_id;
    $scope.currentReport.time = new Date().toISOString().slice(0, 19).replace('T', ' ');
    $ionicLoading.show({
      animation: 'fade-in',
      showBackdrop: true,
      maxWidth: 200,
      showDelay: 0,
      template: '<ion-spinner icon="ripple" class="spinner-calm"></ion-spinner>' +
      '<br/>Salvando, obrigado!...'
    });

    //save report to 'reports' table
    DB.saveReport($scope.currentReport).then(function(){
      //get last reports (limit to 10 / 3 hrs ago)
      DB.getReportsFromPlaceId($scope.currentReport.place_id).then(function(result){
        //calc average (pond 3 to first 5, pond 2 to 6...7, pond 1 to 8...10)
        var total = 0;
        var div = 0;
        var lastreport = result.data[0].time;
        result.data.forEach(function(item, index){
          if(index >= 0 && index < 5) {
            total += item.status * 3;
            div += 3;
          }
          else if(index >= 5 && index < 7){
            total += item.status*2;
            div += 2;
          }
          else if(index >= 7){
            total += item.status*1;
            div += 1;
          }
        });

        var avg = total/div;

        //update average and lastreport on places
        DB.updateStatus($scope.currentReport.place_id, avg, lastreport).then(function(result){
          $ionicLoading.hide();
          updateStatusMarkers();
        });
      });
    });




  }

  function getDateInterval(lastreport){
    if(lastreport == null) return null;
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    dateReport.setHours ( dateReport.getHours() - 3 );
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffDays = Math.floor(diffMs / 86400000); // days
    var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

    var diffTotalHrs = Math.floor((diffMs/86400000)*24);

    return diffTotalHrs;


  }

  $scope.getLastReport = function(lastreport){
    if(lastreport == null) return 'Sem dados';
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    dateReport.setHours ( dateReport.getHours() - 3 );
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffDays = Math.floor(diffMs / 86400000); // days
    var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
    var diffTotalHrs = Math.floor((diffMs/86400000)*24);
    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

    if(diffTotalHrs >= 1){
      if(diffTotalHrs > 3) return 'Sem dados recentes';
      else return roundN(1.0,diffTotalHrs) + 'hrs atrás';
    }else{
      return roundN(1.0,diffMins) + 'min atrás';
    }
  };

  function mysqlTimeStampToDate(timestamp) {
    //function parses mysql datetime string and returns javascript Date object
    //input has to be in this format: 2007-06-05 15:26:02
    var regex=/^([0-9]{2,4})-([0-1][0-9])-([0-3][0-9]) (?:([0-2][0-9]):([0-5][0-9]):([0-5][0-9]))?$/;
    var parts=timestamp.replace(regex,"$1 $2 $3 $4 $5 $6").split(' ');
    return new Date(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]);
  }

  function roundN(N,x) {
    if(x > 0)
      return Math.ceil(x/N) * N;
    else if( x < 0)
      return Math.floor(x/N) * N;
    else
      return N;
  }

  function updateStatusMarkers(){

    clearAllMarkers();
    $scope.zindex++;
    $scope.places.forEach(function(item, index) {
      getPlaceExtraInfo(item, index);
      updateThermometerMarker(item);
    });

    //hack to avoid waiting time until markers shows up
    google.maps.event.addListener($scope.map, 'idle', function(event) {
      var cnt = $scope.map.getCenter();
      cnt.e+=0.000001;
      $scope.map.panTo(cnt);
      cnt.e-=0.000001;
      $scope.map.panTo(cnt);
    });
  }

  function updateThermometerMarker(place) {
    var status = getThermometerMark(place.status, place.lastreport);
    place.marker.setIcon("img/thermometer/"+status+".png");
  }

  function showNearConfirm(name, index) {
    var confirmPopup = $ionicPopup.confirm({
      title: 'Colabore conosco!',
      template: "Você parece estar perto de <b>" +name+ "</b>. Ajude-nos dizendo como está o movimento aí!",
      buttons: [
        { text: 'Agora não' },
        {
          text: '<b>Ok!</b>',
          type: 'button-royal'
        }
      ]
    });

    confirmPopup.then(function(res) {
      if(res) {
        setCurrentPlace(index);
        $scope.openPlace();
        $scope.openThermometer();
      } else {

      }
    });
  }

  function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
  }

  function showAlert(title, text, button) {
    var alertPopup = $ionicPopup.alert({
      title: title,
      template: text,
      okText: button,
      okType: 'button-royal'
    });

    alertPopup.then(function(res) {
    });
  };

  function showConfirm(title, text, buttonOk, buttonNot, success) {

    var confirmPopup = $ionicPopup.confirm({
      title: title,
      template: text,
      buttons: [
        { text: buttonNot },
        {
          text: buttonOk,
          type: 'button-royal'
        }]
    });

    confirmPopup.then(function(res) {
      if(res) {
        success;
      } else {

      }
    });
  }



  /* animations and state */
  $scope.openPlace = function(index){
    var bottomHeight =
      document.getElementById("row-descr").offsetHeight +
      document.getElementById("row-events").offsetHeight +
      document.getElementById("row-photos").offsetHeight +
      document.getElementById("row-links").offsetHeight ;

    document.getElementById("place-info").style.bottom = -bottomHeight + "px";
  };

  $scope.moreInfoPlace = function(){
    getPlaceDetails($scope.currentPlace.place_id);
    document.getElementById("place-info").style.bottom = "0";
  };

  $scope.closePlace = function(index){
    var bottomHeight =
      document.getElementById("row-descr").offsetHeight +
      document.getElementById("row-events").offsetHeight +
      document.getElementById("row-photos").offsetHeight +
      document.getElementById("row-links").offsetHeight ;

    if(document.getElementById("place-info").style.bottom == -bottomHeight + "px")
      document.getElementById("place-info").style.bottom = (-1*(document.getElementById("place-info").offsetHeight) - 40) + "px" ;
    else
      document.getElementById("place-info").style.bottom = -bottomHeight + "px";
  };


  $scope.openThermometer = function(){
    $scope.thermometerModal.show();
    $scope.currentReport.status = $scope.currentPlace.status;
  };

  $scope.closeThermometer = function(){
    $scope.thermometerModal.hide();
    saveThermometerReport();
  };

  $scope.goToSuggestions = function(){
    $state.go('app.suggestions');
  };

  $scope.goToSearch = function(query){
    $state.go('app.search', {query: query});
  };

  $scope.getThermIcon = function(status, lastreport){
    return 'img/thermometer/' + getThermometerMark(status, lastreport) + '.png';
  };

  $scope.openImagesModal = function(index) {
    $scope.showImagesModal('templates/image-popover.html');
    $timeout(function(){
      $ionicSlideBoxDelegate.$getByHandle('images-slider').slide(index);
    }, 500);
  };

  $scope.showImagesModal = function(templateUrl) {
    $ionicModal.fromTemplateUrl(templateUrl, {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.imagesModal = modal;
      $scope.imagesModal.show();
    });
  };

  // Close the modal
  $scope.closeImagesModal = function() {
    $scope.imagesModal.hide();
    $scope.imagesModal.remove()
  };

  
  $scope.showEvents = function(){
    $rootScope.updateFbStatus();
    if($rootScope.fbAccessToken != null)
      getFacebookEvents($scope.currentPlace.facebook_id);
    else {
      showConfirm("Ainda não!?", "Para ter acesso à essa e muitas outras informações, é necessário que você esteja logado(a) no Facebook. Isso tornará sua experiência muito mais completa!", "Logar com Facebook", "Agora não :(", $rootScope.fbLogin());
    }
  };

  $scope.showEventsModal = function() {
    $ionicModal.fromTemplateUrl("templates/events.html", {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.eventsModal = modal;
      $scope.eventsModal.show();
    });
  };


  // Close the modal
  $scope.closeEventsModal = function() {
    $scope.eventsModal.hide();
    $scope.eventsModal.remove()
  };





});

app.controller('SuggestionsCtrl', function($scope, $state,  $cordovaGeolocation, $timeout, $sce, DB, $ionicLoading, $ionicModal, $ionicPopup, ngFB, $rootScope) {

  console.log("oppening suggestions");

  //initial variables
  $scope.options = {};
  $scope.options.radius = 10;

  $scope.options.maxPrice = 3;
  $scope.prices =["$","$$","$$$","$$$$"];

  $scope.options.night_club = true;
  $scope.options.bar = true;
  $scope.options.restaurant = false;

  $scope.options.categories = [];
  $scope.options.categories[0] = $scope.options.night_club ? 'night_club' : "" ;
  $scope.options.categories[1] = $scope.options.bar ? 'bar' : "" ;
  $scope.options.categories[2] = $scope.options.restaurant ? 'restaurant' : "" ;

  //set service
  $scope.placesService = new google.maps.places.PlacesService(document.getElementById('sugView').appendChild(document.createElement('div')));


  //search once
  searchPlaces();



  function getMyPositionAndSearch(){
    //get current location
    var geoOptions = {maximumAge: 60000, timeout: 10000, enableHighAccuracy: false};
    var get = $cordovaGeolocation.getCurrentPosition(geoOptions);
    console.log("getting position");
    get.then(
      function(position) {
        console.log("Got position ");
        $scope.myPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        $rootScope.myPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        console.log($scope.myPosition.lat() + ' ' + $scope.myPosition.lng());

        var request = {
          location: $scope.myPosition,
          radius: $scope.options.radius*1000,
          types: $scope.options.categories,
          openNow: true
        };
        $scope.placesService.nearbySearch(request, populatePlaces);

      }),
      function(error){ alert("Could not get location");  };
  }
  //finds places by Google Radar Search
  $scope.gPlaces = [];

  function searchPlaces(){
    console.log("searching places");

    $ionicLoading.show({
      animation: 'fade-in',
      showBackdrop: true,
      maxWidth: 200,
      showDelay: 0,
      template: '<ion-spinner icon="ripple" class="spinner-calm"></ion-spinner>' +
      '<br/>Calculando...'
    });
    $scope.gPlaces = [];

    getMyPositionAndSearch();

  }

  function populatePlaces(results, status) {
    console.log("statuss search: " + status);
    if (status !== google.maps.places.PlacesServiceStatus.OK) {
      console.error("nearby search:" + status);
      return;
    }

    console.log("Search results:");
    console.log(results);

    $scope.gPlaces = results;
    for (var i = 0; i < results.length ; i++) {

      var place = results[i];
      //getting distance
      place.distance = getDistanceFromLatLonInKm($scope.myPosition, place.geometry.location);
      if(place.distance > 1)
        place.distanceText = roundN(1,place.distance) + " km";
      else
        place.distanceText = roundN(1,place.distance*1000) + " m";

      //TODO add restaurant category
      //set category
      if(place.types.includes('night_club') && place.types.includes('bar'))
        place.category = "Bar Balada";
      else if(place.types.includes('night_club'))
        place.category = "Balada";
      else if(place.types.includes('bar'))
        place.category = "Bar";

      //set current place main photo
      if(typeof place.photos != 'undefined')
        place.photo = $sce.trustAsResourceUrl(place.photos[0].getUrl({'maxWidth': 300, 'maxHeight': 300}));
      else
        place.photo = "img/no-photo.jpg";

      if(place.distance <= $scope.options.radius + 1){
        //get info on Backand
        getPlaceInfo(place, i);
      }


    }


  }

  function getPlaceInfo(place, index){

    DB.getPlaceByPlaceId(place.place_id).then(function(response){
      var dbPlace = response.data[0];
      if(dbPlace != null){
        //sets info directly on main array
        $scope.gPlaces[index].status = dbPlace.status;
        $scope.gPlaces[index].lastreport = dbPlace.lastreport;
        $scope.gPlaces[index].price = dbPlace.price;
        $scope.gPlaces[index].weight = calcWeight($scope.gPlaces[index]);

        //if it is the last place on array, sort it
        if(index == $scope.gPlaces.length - 1){
          $scope.gPlaces.sort(function(a, b){
            console.log(" sorting array...");
            if(a.weight > b.weight) return -1;
            if(a.weight < b.weight) return 1;

            if(a.status > b.status) return -1;
            if(a.status < b.status) return 1;

            if(a.distance < b.distance) return -1;
            if(a.distance > b.distance) return 1;
            return 0;
          });

          console.log('Sorted array: ');
          console.log($scope.gPlaces);
          $ionicLoading.hide();
        }


      }else{
        $ionicLoading.hide();
        //if not found on db, save it in db
        //TODO dont increase id when INSERT IGNORE
        var newPlace = {};
        newPlace.place_id = place.place_id;
        newPlace.address = place.vicinity;
        newPlace.name = place.name;
        newPlace.lat = place.geometry.location.lat();
        newPlace.long = place.geometry.location.lng();
        newPlace.type = place.types[0] + " " + place.types[1] + " " + place.types[2];

        DB.savePlaceIfNotExists(newPlace).then(function(result) {
          console.log("saved on db: " + place.name);
        });
      }
    });
  }

  function calcWeight(place){
    var dist = place.distance;
    var price = place.price;
    var hrsAgo = getDateInterval(place.lastreport);
    var status = place.status;
    var weight = 0;

    if(price == '?' || price == null) price = 0;
    if(price == '$') price = 1;
    if(price == '$$') price = 2;
    if(price == '$$$') price = 3;
    if(price == '$$$$') price = 4;

    if(dist < 1) weight += 6;
    if(dist < 2) weight += 4;
    if(dist < 4) weight += 3;
    if(dist < 8) weight += 2;
    if(dist < 12) weight += 1;

    if(price != 0){
      if(price - 1 > $scope.options.maxPrice)
        weight -= price - 1 - $scope.options.maxPrice;
    }
    if(hrsAgo < 3 && hrsAgo != null){
      if(hrsAgo < 0.2) weight += 3;
      if(hrsAgo < 0.5) weight += 2;
      if(hrsAgo < 1) weight += 1;

      weight += status*2;

    }



    return weight;
  }

  function getDistanceFromLatLonInKm(pos1,pos2, geo) {
    if(geo){
      var lat1 = pos1.coords.latitude ;
      var lon1 = pos1.coords.longitude ;

      var lat2 = pos2.coords.latitude;
      var lon2 = pos2.coords.longitude;

    }else{
      var lat1 =  pos1.lat();
      var lon1 =  pos1.lng();

      var lat2 = pos2.lat();
      var lon2 = pos2.lng();

    }

    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1);
    var a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
      ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    return d;

    function deg2rad(deg) {
      return deg * (Math.PI/180)
    }
  }
  function getDateInterval(lastreport){
    if(lastreport == null) return null;
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    dateReport.setHours ( dateReport.getHours() - 3 );
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffDays = Math.floor(diffMs / 86400000); // days
    var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

    var diffTotalHrs = Math.floor((diffMs/86400000)*24);

    return diffTotalHrs;

  }
  function roundN(N,x) {
    if(x > 0)
      return Math.ceil(x/N) * N;
    else if( x < 0)
      return Math.floor(x/N) * N;
    else
      return N;
  }
  function getThermometerMark(status, lastreport){
    if(getDateInterval(lastreport) > 3 ) return 0; //if lastreport was earlier than 3 hrs ago, ignore
    if(status == 0 || status == null) return 0;
    if(status < 1.5) return 1;
    if(status >= 1.5 && status < 2.5) return 2;
    if(status >= 2.5 && status < 3.5) return 3;
    if(status >= 3.5 && status < 4.5) return 4;
    if(status >= 4.5 && status < 5.5) return 5;
    if(status >= 5.5 && status < 6.5) return 6;
    if(status >= 6.5 && status < 7.5) return 7;
    if(status >= 7.5 && status < 8.5) return 8;
    if(status >= 8.5 && status < 9.5) return 9;
    if(status >= 9.5) return 10;
  }

  function mysqlTimeStampToDate(timestamp) {
    //function parses mysql datetime string and returns javascript Date object
    //input has to be in this format: 2007-06-05 15:26:02
    var regex=/^([0-9]{2,4})-([0-1][0-9])-([0-3][0-9]) (?:([0-2][0-9]):([0-5][0-9]):([0-5][0-9]))?$/;
    var parts=timestamp.replace(regex,"$1 $2 $3 $4 $5 $6").split(' ');
    return new Date(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]);
  }

  $scope.getLastReport = function(lastreport){
    if(lastreport == null) return 'Sem dados';
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    dateReport.setHours ( dateReport.getHours() - 3 );
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffDays = Math.floor(diffMs / 86400000); // days
    var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
    var diffTotalHrs = Math.floor((diffMs/86400000)*24);
    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

    if(diffTotalHrs >= 1){
      if(diffTotalHrs > 3) return 'Sem dados recentes';
      else return roundN(1.0,diffTotalHrs) + 'hrs atrás';
    }else{
      return roundN(1.0,diffMins) + 'min atrás';
    }
  };

  $scope.refresh = (function(){
    searchPlaces();
  });

  $scope.getThermIcon = function(status, lastreport){
    return 'img/thermometer/' + getThermometerMark(status, lastreport) + '.png';
  };

  $scope.goToPlace = function(place_id){
    $state.go('app.place', { placeId: place_id} );
  };

  $scope.toggle = function(id){
    var elems = document.getElementsByClassName('option');
    for(var i = 0; i < elems.length; i++) {
      if(elems[i] != document.getElementById(id))
        elems[i].style.bottom = '-182px';
    }

    if(document.getElementById(id).style.bottom == "-182px")
      document.getElementById(id).style.bottom = "52px";
    else
      document.getElementById(id).style.bottom = "-182px";
  };
});

app.controller('SearchCtrl', function($scope, $state,  $cordovaGeolocation, $timeout, $sce, DB, $ionicLoading, $ionicModal, $ionicPopup, ngFB, $rootScope, $stateParams, $ionicHistory) {

  //initial variables
  $scope.options = {};
  $scope.options.radius = 20;

  $scope.options.maxPrice = 3;
  $scope.prices = ["$","$$","$$$","$$$$"];

  $scope.options.night_club = true;
  $scope.options.bar = true;
  $scope.options.restaurant = true;

  $scope.options.categories = [];
  $scope.options.categories[0] = $scope.options.night_club ? 'night_club' : "" ;
  $scope.options.categories[1] = $scope.options.bar ? 'bar' : "" ;
  $scope.options.categories[2] = $scope.options.restaurant ? 'restaurant' : "" ;

  $scope.query = $stateParams.query;
  //set service
  $scope.placesService = new google.maps.places.PlacesService(document.getElementById('searchView').appendChild(document.createElement('div')));


  //search once
  searchPlaces();



  function getMyPositionAndSearch(){
    //get current location
    var geoOptions = {maximumAge: 60000, timeout: 10000, enableHighAccuracy: false};
    var get = $cordovaGeolocation.getCurrentPosition(geoOptions);
    get.then(
      function(position) {
        console.log("Got position ");
        $scope.myPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        $rootScope.myPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        console.log($scope.myPosition.lat() + ' ' + $scope.myPosition.lng());

        var request = {
          location: $scope.myPosition,
          radius: $scope.options.radius*1000,
          types: $scope.options.categories,
          query: $scope.query,
          key: "AIzaSyBXrel9dJS_qBVE3aQg-b59qNSkHRV8HvE"
        };
        $scope.placesService.textSearch(request, populatePlaces);

      }),
      function(error){ alert("Could not get location");  };
  }
  //finds places by Google Radar Search
  $scope.gPlaces = [];

  function searchPlaces(){

    $ionicLoading.show({
      animation: 'fade-in',
      showBackdrop: true,
      maxWidth: 200,
      showDelay: 0,
      template: '<ion-spinner icon="ripple" class="spinner-calm"></ion-spinner>' +
      '<br/>Procurando...'
    });
    $scope.gPlaces = [];

    getMyPositionAndSearch();

  }

  function populatePlaces(results, status) {
    if (status !== google.maps.places.PlacesServiceStatus.OK) {
      console.error("nearby search:" + status);
      return;
    }

    console.log("Search results:");
    console.log(results);
    $scope.gPlaces = removeDuplicates(results, "place_id");
    for (var i = 0; i < $scope.gPlaces.length ; i++) {

      var place = $scope.gPlaces[i];

      //TODO add restaurant category
      //set category
      if(place.types.includes('night_club') && place.types.includes('bar'))
        place.category = "Bar Balada";
      else if(place.types.includes('night_club'))
        place.category = "Balada";
      else if(place.types.includes('bar'))
        place.category = "Bar";
      else{
        place.hide = true;
      }

      //getting distance
      place.distance = getDistanceFromLatLonInKm($scope.myPosition, place.geometry.location);
      if(place.distance > 1)
        place.distanceText = roundN(1,place.distance) + " km";
      else
        place.distanceText = roundN(1,place.distance*1000) + " m";



      //set current place main photo
      if(typeof place.photos != 'undefined')
        place.photo = $sce.trustAsResourceUrl(place.photos[0].getUrl({'maxWidth': 300, 'maxHeight': 300}));
      else
        place.photo = "img/no-photo.jpg";

      //get info on backand
      getPlaceInfo(place, i);



    }


  }

  function getPlaceInfo(place, index){

    DB.getPlaceByPlaceId(place.place_id).then(function(response){
      var dbPlace = response.data[0];
      if(dbPlace != null){
        //sets info directly on main array
        $scope.gPlaces[index].status = dbPlace.status;
        $scope.gPlaces[index].lastreport = dbPlace.lastreport;

        //if price is greater than max, remove it.
        dbPlace.priceNum = $scope.prices.indexOf(dbPlace.price);
        if(dbPlace.priceNum != null && dbPlace.priceNum > $scope.options.maxPrice){
          $scope.gPlaces.splice(index, 1);
        }else $scope.gPlaces[index].price = dbPlace.price;

        $scope.gPlaces[index].weight = calcWeight($scope.gPlaces[index]);

        //if it is the last place on array, sort it
        $ionicLoading.hide();


      }else{
        $ionicLoading.hide();
        //if not found on db, save it in db
        //TODO dont increase id when INSERT IGNORE
        var newPlace = {};
        newPlace.place_id =  $scope.gPlaces[index].place_id;
        newPlace.address =  $scope.gPlaces[index].formatted_address;
        newPlace.name =  $scope.gPlaces[index].name;
        newPlace.lat =  $scope.gPlaces[index].geometry.location.lat();
        newPlace.long =  $scope.gPlaces[index].geometry.location.lng();
        newPlace.type =  $scope.gPlaces[index].types[0] + " " +  $scope.gPlaces[index].types[1] + " " +  $scope.gPlaces[index].types[2];

        DB.savePlaceIfNotExists(newPlace).then(function(result) {
          console.log("saved on db: " +  $scope.gPlaces[index].name);
        });
      }
    });
  }

  function calcWeight(place){
    var dist = place.distance;
    var price = place.price;
    var hrsAgo = getDateInterval(place.lastreport);
    var status = place.status;
    var weight = 0;

    if(price == '?' || price == null) price = 0;
    if(price == '$') price = 1;
    if(price == '$$') price = 2;
    if(price == '$$$') price = 3;
    if(price == '$$$$') price = 4;

    if(dist < 1) weight += 6;
    if(dist < 2) weight += 4;
    if(dist < 4) weight += 3;
    if(dist < 8) weight += 2;
    if(dist < 12) weight += 1;

    if(price != 0){
      if(price - 1 > $scope.options.maxPrice)
        weight -= price - 1 - $scope.options.maxPrice;
    }
    if(hrsAgo < 3 && hrsAgo != null){
      if(hrsAgo < 0.2) weight += 3;
      if(hrsAgo < 0.5) weight += 2;
      if(hrsAgo < 1) weight += 1;

      weight += status*2;

    }



    return weight;
  }

  function getDistanceFromLatLonInKm(pos1,pos2, geo) {
    if(geo){
      var lat1 = pos1.coords.latitude ;
      var lon1 = pos1.coords.longitude ;

      var lat2 = pos2.coords.latitude;
      var lon2 = pos2.coords.longitude;

    }else{
      var lat1 =  pos1.lat();
      var lon1 =  pos1.lng();

      var lat2 = pos2.lat();
      var lon2 = pos2.lng();

    }

    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1);
    var a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
      ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    return d;

    function deg2rad(deg) {
      return deg * (Math.PI/180)
    }
  }
  function getDateInterval(lastreport){
    if(lastreport == null) return null;
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    dateReport.setHours ( dateReport.getHours() - 3 );
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffDays = Math.floor(diffMs / 86400000); // days
    var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

    var diffTotalHrs = Math.floor((diffMs/86400000)*24);

    return diffTotalHrs;

  }
  function roundN(N,x) {
    if(x > 0)
      return Math.ceil(x/N) * N;
    else if( x < 0)
      return Math.floor(x/N) * N;
    else
      return N;
  }
  function getThermometerMark(status, lastreport){
    if(getDateInterval(lastreport) > 3 ) return 0; //if lastreport was earlier than 3 hrs ago, ignore
    if(status == 0 || status == null) return 0;
    if(status < 1.5) return 1;
    if(status >= 1.5 && status < 2.5) return 2;
    if(status >= 2.5 && status < 3.5) return 3;
    if(status >= 3.5 && status < 4.5) return 4;
    if(status >= 4.5 && status < 5.5) return 5;
    if(status >= 5.5 && status < 6.5) return 6;
    if(status >= 6.5 && status < 7.5) return 7;
    if(status >= 7.5 && status < 8.5) return 8;
    if(status >= 8.5 && status < 9.5) return 9;
    if(status >= 9.5) return 10;
  }

  function mysqlTimeStampToDate(timestamp) {
    //function parses mysql datetime string and returns javascript Date object
    //input has to be in this format: 2007-06-05 15:26:02
    var regex=/^([0-9]{2,4})-([0-1][0-9])-([0-3][0-9]) (?:([0-2][0-9]):([0-5][0-9]):([0-5][0-9]))?$/;
    var parts=timestamp.replace(regex,"$1 $2 $3 $4 $5 $6").split(' ');
    return new Date(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]);
  }

  function removeDuplicates(arr, prop) {
    var new_arr = [];
    var lookup  = {};

    for (var i in arr) {
      lookup[arr[i][prop]] = arr[i];
    }

    for (i in lookup) {
      new_arr.push(lookup[i]);
    }

    return new_arr;
  }

  $scope.getLastReport = function(lastreport){
    if(lastreport == null) return 'Sem dados';
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    dateReport.setHours ( dateReport.getHours() - 3 );
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffDays = Math.floor(diffMs / 86400000); // days
    var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
    var diffTotalHrs = Math.floor((diffMs/86400000)*24);
    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

    if(diffTotalHrs >= 1){
      if(diffTotalHrs > 3) return 'Sem dados recentes';
      else return roundN(1.0,diffTotalHrs) + 'hrs atrás';
    }else{
      return roundN(1.0,diffMins) + 'min atrás';
    }
  };

  $scope.refresh = (function(){
    searchPlaces();
  });

  $scope.getThermIcon = function(status, lastreport){
    return 'img/thermometer/' + getThermometerMark(status, lastreport) + '.png';
  };

  $scope.goToPlace = function(place_id){
    $state.go('app.place', { placeId: place_id} );
  };

  $scope.toggle = function(id){
    var elems = document.getElementsByClassName('option');
    for(var i = 0; i < elems.length; i++) {
      if(elems[i] != document.getElementById(id))
        elems[i].style.bottom = '-182px';
    }

    if(document.getElementById(id).style.bottom == "-182px")
      document.getElementById(id).style.bottom = "52px";
    else
      document.getElementById(id).style.bottom = "-182px";
  };

  $scope.goBack = function(){
    $ionicHistory.goBack();
  };
});


app.controller('PlaceCtrl', function($scope, $stateParams ,$cordovaGeolocation, $timeout, $sce, DB, $ionicLoading, $ionicModal, $ionicPopup, ngFB, $rootScope, $ionicSlideBoxDelegate ) {

  /* initial variables */

  $scope.currentReport = {};
  $scope.currentReport.status = 4;
  $ionicModal.fromTemplateUrl('templates/thermometer.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.thermometerModal = modal;
  });

  $scope.currentPlace = {};
  $scope.currentPlace.events = [];


  getPlaceDetails($stateParams.placeId);


  function calcDistance(origin, destiny){
    var service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destiny],
        travelMode: google.maps.TravelMode.WALKING
      }, callbackDistance);

    function callbackDistance(response, status) {
      if (status == google.maps.DistanceMatrixStatus.OK) {
        var origins = response.originAddresses;

        for (var i = 0; i < origins.length; i++) {
          var results = response.rows[i].elements;
          for (var j = 0; j < results.length; j++) {
            var element = results[j];
            $scope.currentPlace.distance = element.distance.text;
          }
        }
      }

      $scope.$apply;
    }
  }

  function getPlaceDetails(place_id){

    $ionicLoading.show({
      animation: 'fade-in',
      showBackdrop: true,
      maxWidth: 200,
      showDelay: 0,
      template: '<ion-spinner icon="ripple" class="spinner-calm"></ion-spinner>' +
      '<br/>Carregando...'
    });

    $scope.hideSpinner = false;
    $scope.noPhotos = false;
    var request = {
      placeId: place_id
    };

    var service = new google.maps.places.PlacesService(document.getElementById('placeView').appendChild(document.createElement('div')));
    service.getDetails(request,
      function callback(place, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          console.log("Google Details:");
          console.log(place);


          $scope.currentPlace = place;
          $scope.currentPlace.allPhotos = place.photos;
          if(typeof place.photos == "undefined") {
            $scope.noPhotos = true;
          }
          $scope.currentPlace.website = place.website;
          //set current place main photo
          if(typeof $scope.currentPlace.photos != 'undefined')
            $scope.currentPlace.photo = $sce.trustAsResourceUrl($scope.currentPlace.photos[0].getUrl({'maxWidth': 300, 'maxHeight': 300}));
          else
            $scope.currentPlace.photo = "img/no-photo.jpg";

          //set image of category
          //TODO add restaurant category
          if($scope.currentPlace.types.includes('night_club') && $scope.currentPlace.types.includes('bar'))
            $scope.currentPlace.category = "Bar Balada";
          else if($scope.currentPlace.types.includes('night_club'))
            $scope.currentPlace.category = "Balada";
          else if($scope.currentPlace.types.includes('bar'))
            $scope.currentPlace.category = "Bar";

          //calculate distance from my position
          $timeout(function(){
            calcDistance($rootScope.myPosition, $scope.currentPlace.geometry.location);
            $scope.$apply();
          });


          DB.getPlaceByPlaceId(place.place_id).then(function(result){
            var dbPlace = result.data[0];
            console.log("DB details: ");
            console.log(dbPlace);

            if(typeof dbPlace == "undefined"){
              $scope.currentPlace.description ="Sem descrição" ;
              $scope.currentPlace.facebook = "";
              $scope.currentPlace.price = "?";
              $scope.hideSpinner = true;
              $ionicLoading.hide();

              //save place into db
              //TODO dont increase id when INSERT IGNORE
              var newPlace = {};
              newPlace.place_id = $scope.currentPlace.place_id;
              newPlace.address = $scope.currentPlace.vicinity;
              newPlace.name = $scope.currentPlace.name;
              newPlace.lat = $scope.currentPlace.geometry.location.lat();
              newPlace.long = $scope.currentPlace.geometry.location.lng();
              newPlace.type = $scope.currentPlace.types[0] + " " + $scope.currentPlace.types[1] + " " + $scope.currentPlace.types[2];


              DB.savePlaceIfNotExists(newPlace).then(function(result) {
                console.log("Saved to db: " + newPlace.name);
              });
              return;
            }

            //if place exists in db
            $scope.currentPlace.status = typeof dbPlace.status != "undefined" ? dbPlace.status : 0;
            $scope.currentPlace.lastreport = typeof dbPlace.lastreport != "undefined" ? dbPlace.lastreport : null;
            $scope.currentPlace.facebook_id = dbPlace.facebook_id || null;

            $ionicLoading.hide();

            if(dbPlace.facebook == null && $rootScope.fbAccessToken != null){
              getFacebookPlace(place, function(fbPlace){

                if(fbPlace == false){
                  $scope.currentPlace.description = dbPlace.description == null ? "Sem descrição" : dbPlace.description ;
                  $scope.currentPlace.price = dbPlace.price == null ? "?" : dbPlace.price;
                  $scope.hideSpinner = true;
                  return;
                }
                console.log("FB details: ");
                console.log(fbPlace);
                $scope.currentPlace.description = fbPlace.about != null ? fbPlace.about : fbPlace.description;
                $scope.currentPlace.facebook = fbPlace.link;
                $scope.currentPlace.facebook_id = fbPlace.id;

                $scope.currentPlace.price = fbPlace.price_range == null ? "?" : fbPlace.price_range;
                if(place.website == null){
                  if(fbPlace.website != null)
                    $scope.currentPlace.website = fbPlace.website;
                  else
                    $scope.currentPlace.website = fbPlace.link;
                }

                $scope.hideSpinner = true;

                DB.updatePlace($scope.currentPlace.place_id, $scope.currentPlace).then(function(){
                  console.log("Facebook details updated in database");
                });
              });
            }else{
              $scope.currentPlace.description = dbPlace.description == null ? "Sem descrição" : dbPlace.description ;
              $scope.currentPlace.facebook = dbPlace.facebook;
              $scope.currentPlace.price = dbPlace.price;
              $scope.hideSpinner = true;
            }


            $timeout(function() {
              $scope.$apply();
            });
          });

        }else alert(status);
      });
  }

  function getFacebookPlace(place, callback){
    //search for page of place in facebook
    var rightPlace = {};
    ngFB.api({
      path: '/search',
      params: {
        q: place.name,
        type: "page",
        access_token: $rootScope.fbAccessToken,
        fields: 'description,about,cover,link,place_type,price_range,location,name,website'
      }
    }).then(
      function (pages) {
        var found = false;
        for(var i = 0; i < pages.data.length ; i++){
          /* if the place has almost the same coordinates */
          if(pages.data[i].place_type == "PLACE" &&
            Math.floor(pages.data[i].location.latitude*1000)/1000 == Math.floor(place.geometry.location.lat()*1000)/1000 &&
            Math.floor(pages.data[i].location.longitude*1000)/1000 == Math.floor(place.geometry.location.lng()*1000)/1000){

            console.log('found ' +pages.data[i].name );
            found = true;
            rightPlace = pages.data[i];
            console.log(rightPlace);
            callback(rightPlace);

          }
        }

        if(!found) callback(false);
      },
      function (error) {
        console.log('Facebook error: ' + error.error_description);
        callback(false);
      });


  }
  function getFacebookEvents(page_id, callback){
    ngFB.api({
      path: '/' + page_id + '/events',
      params: {
        fields: 'cover,attending_count,interested_count,name,description,is_page_owned,start_time,type,ticket_uri',
        since: Math.floor(Date.now() / 1000) - (60*60*24), //since yesterday
        access_token: $rootScope.fbAccessToken
      }
    }).then(
      function (response) {
        if(response.data.length == 0) {
          showAlert("Oops :(", "Não há eventos desse local no Facebook...", "OK");
          return;
        }
        var events = response.data;
        console.log(events);
        for(var i=0; i < events.length; i++){
          var event = events[i];
          var date = mysqlTimeStampToDate(event.start_time.replace('T', ' ').substring(0,19));
          var dia= pad(date.getDate(),2);
          var mes= pad(date.getMonth() + 1,2);
          var ano=date.getFullYear();
          var hora= pad(date.getHours(),2);
          var minutos = pad(date.getMinutes(),2) ;
          var dias = ["Dom", "Seg","Ter", "Qua", "Qui", "Sex", "Sáb"];
          if((new Date()).toDateString() == date.toDateString())
            event.formatDate = "Hoje às " + hora + ':' + minutos;
          else
            event.formatDate = dia + '/' + mes + '/' + ano + ' (' +  dias[date.getDay()]+ ') às ' + hora + ':' + minutos;
          event.descrOpen = false;
        }
        $scope.currentPlace.events = events;
        $scope.showEventsModal();
      },
      function (error) {
        showAlert("Oops :(", "Não encontramos eventos desse local no Facebook...", "OK");
        console.log('Facebook error: ' + error.error_description);
      });
  }


  function getDateInterval(lastreport){
    if(lastreport == null) return null;
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    dateReport.setHours ( dateReport.getHours() - 3 );
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffDays = Math.floor(diffMs / 86400000); // days
    var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

    var diffTotalHrs = Math.floor((diffMs/86400000)*24);

    return diffTotalHrs;

  }
  function roundN(N,x) {
    if(x > 0)
      return Math.ceil(x/N) * N;
    else if( x < 0)
      return Math.floor(x/N) * N;
    else
      return N;
  }
  function getThermometerMark(status, lastreport){
    if(getDateInterval(lastreport) > 3 ) return 0; //if lastreport was earlier than 3 hrs ago, ignore
    if(status == 0 || status == null) return 0;
    if(status < 1.5) return 1;
    if(status >= 1.5 && status < 2.5) return 2;
    if(status >= 2.5 && status < 3.5) return 3;
    if(status >= 3.5 && status < 4.5) return 4;
    if(status >= 4.5 && status < 5.5) return 5;
    if(status >= 5.5 && status < 6.5) return 6;
    if(status >= 6.5 && status < 7.5) return 7;
    if(status >= 7.5 && status < 8.5) return 8;
    if(status >= 8.5 && status < 9.5) return 9;
    if(status >= 9.5) return 10;
  }
  function mysqlTimeStampToDate(timestamp) {
    //function parses mysql datetime string and returns javascript Date object
    //input has to be in this format: 2007-06-05 15:26:02
    var regex=/^([0-9]{2,4})-([0-1][0-9])-([0-3][0-9]) (?:([0-2][0-9]):([0-5][0-9]):([0-5][0-9]))?$/;
    var parts=timestamp.replace(regex,"$1 $2 $3 $4 $5 $6").split(' ');
    return new Date(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]);
  }
  function saveThermometerReport(){
    $scope.currentReport.place_id = $scope.currentPlace.place_id;
    $scope.currentReport.time = new Date().toISOString().slice(0, 19).replace('T', ' ');
    $ionicLoading.show({
      animation: 'fade-in',
      showBackdrop: true,
      maxWidth: 200,
      showDelay: 0,
      template: '<ion-spinner icon="ripple" class="spinner-calm"></ion-spinner>' +
      '<br/>Salvando, obrigado!...'
    });

    //save report to 'reports' table
    DB.saveReport($scope.currentReport).then(function(){
      //get last reports (limit to 10 / 3 hrs ago)
      DB.getReportsFromPlaceId($scope.currentReport.place_id).then(function(result){
        //calc average (pond 3 to first 5, pond 2 to 6...7, pond 1 to 8...10)
        var total = 0;
        var div = 0;
        var lastreport = result.data[0].time;
        result.data.forEach(function(item, index){
          if(index >= 0 && index < 5) {
            total += item.status * 3;
            div += 3;
          }
          else if(index >= 5 && index < 7){
            total += item.status*2;
            div += 2;
          }
          else if(index >= 7){
            total += item.status*1;
            div += 1;
          }
        });

        var avg = total/div;

        //update average and lastreport on places
        DB.updateStatus($scope.currentReport.place_id, avg, lastreport).then(function(result){
          $ionicLoading.hide();
          getPlaceDetails($stateParams.placeId);
        });
      });
    });




  }
  function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
  }

  function showAlert(title, text, button) {
    var alertPopup = $ionicPopup.alert({
      title: title,
      template: text,
      okText: button,
      okType: 'button-royal'
    });

    alertPopup.then(function(res) {
    });
  };

  function showConfirm(title, text, buttonOk, buttonNot, success) {

      var confirmPopup = $ionicPopup.confirm({
      title: title,
      template: text,
      buttons: [
        { text: buttonNot },
        {
          text: buttonOk,
          type: 'button-royal'
        }]
      });

    confirmPopup.then(function(res) {
      if(res) {
        success();
      } else {

      }
    });
  };

  $scope.getLastReport = function(lastreport){
    if(lastreport == null) return 'Sem dados';
    var now = new Date();
    lastreport = lastreport.replace('T', ' ');
    var dateReport = mysqlTimeStampToDate(lastreport);
    dateReport.setHours ( dateReport.getHours() - 3 );
    var diffMs = (now - dateReport); // milliseconds between now & dateReport
    var diffDays = Math.floor(diffMs / 86400000); // days
    var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
    var diffTotalHrs = Math.floor((diffMs/86400000)*24);
    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

    if(diffTotalHrs >= 1){
      if(diffTotalHrs > 3) return 'Sem dados recentes';
      else return roundN(1.0,diffTotalHrs) + 'hrs atrás';
    }else{
      return roundN(1.0,diffMins) + 'min atrás';
    }
  };

  $scope.openThermometer = function(){
    $scope.thermometerModal.show();
    $scope.currentReport.status = $scope.currentPlace.status;
  };

  $scope.closeThermometer = function(){
    $scope.thermometerModal.hide();
    saveThermometerReport();
  };

  $scope.getThermIcon = function(status, lastreport){
    return 'img/thermometer/' + getThermometerMark(status, lastreport) + '.png';
  };

  $scope.openImagesModal = function(index) {
    $scope.showImagesModal('templates/image-popover.html');
    $timeout(function(){
      $ionicSlideBoxDelegate.$getByHandle('images-slider').slide(index);
    }, 500);
  };

  $scope.showImagesModal = function(templateUrl) {
    $ionicModal.fromTemplateUrl(templateUrl, {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.imagesModal = modal;
      $scope.imagesModal.show();
    });
  };



  // Close the modal
  $scope.closeImagesModal = function() {
    $scope.imagesModal.hide();
    $scope.imagesModal.remove()
  };

  $scope.showEvents = function(){
    $rootScope.updateFbStatus();
    if($rootScope.fbAccessToken != null)
      getFacebookEvents($scope.currentPlace.facebook_id);
    else {
      showConfirm("Ainda não!?", "Para ter acesso à essa e muitas outras informações, é necessário que você esteja logado(a) no Facebook. Isso tornará sua experiência muito mais completa!", "Logar com Facebook", "Agora não :(", $rootScope.fbLogin());
    }
  };

  $scope.showEventsModal = function() {
    $ionicModal.fromTemplateUrl("templates/events.html", {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.eventsModal = modal;
      $scope.eventsModal.show();
    });
  };

  // Close the modal
  $scope.closeEventsModal = function() {
    $scope.eventsModal.hide();
    $scope.eventsModal.remove()
  };



});



app.service('DB', function ($http, Backand) {
  var service = this,
    baseUrl = '/1/objects/',
    objectPlaces = 'places/',
    objectReports = 'reports/';

  function getUrl() {
    return Backand.getApiUrl() + baseUrl + objectPlaces;
  }

  function getReportsUrl() {
    return Backand.getApiUrl() + baseUrl + objectReports;
  }

  function getUrlForId(id) {
    return getUrl() + id;
  }

  function escapeString(title) {
    title = title.replace(/'/g, "");
    title = escape(title);
    return title
  }

  //We are not going to use this.
  service.getAllPlaces = function () {
    return $http.get(getUrl());
  };

  //Get unique place by id (Backand)
  service.getPlaceById = function (id) {
    return $http.get(getUrlForId(id));
  };

  //Get unique place by place_id (Google Places)
  service.getPlaceByPlaceId = function (place_id){
    return $http ({
      method: 'POST',
      url: Backand.getApiUrl() + '/1/query/data/getPlaceByPlaceId',
      params: {
        parameters: {
          place_id: place_id
        }
      }
    });
  };

  /*service.placeExists = function(place, callback){
    this.getPlaceByPlaceId(place.place_id).then(function (result) {
      if(result.data.length > 0) callback(true);
      else callback(false);
    });
  };*/

  //Save place
  service.savePlace = function (object) {
    return $http.post(getUrl(), object);
  };



  service.savePlaceIfNotExists= function(place){

    return $http ({
      method: 'GET',
      url: Backand.getApiUrl() + '/1/query/data/insertIfNotExists',
      params: {
        parameters: {
          place_id: place.place_id,
          address: escapeString(place.address),
          name: escapeString(place.name),
          type: place.type,
          lat: place.lat,
          long: place.long
        }
      }
    });
  };

  //Update place info
  service.updatePlace = function (id, object) {
    return $http.put(getUrlForId(id), object);
  };

  //Delete place
  service.deletePlace = function (id) {
    return $http.delete(getUrlForId(id));
  };


  /* Reports */
  service.saveReport = function (object) {
    return $http.post(getReportsUrl(), object);
  };

  service.getReportsFromPlaceId = function (place_id) {
    return $http ({
      method: 'GET',
      url: Backand.getApiUrl() + '/1/query/data/selectLastReports',
      params: {
        parameters: {
          place_id: place_id
        }
      }
    });
  };

  service.updateStatus = function(place_id, status, lastreport){
    return $http ({
      method: 'GET',
      url: Backand.getApiUrl() + '/1/query/data/updateStatus',
      params: {
        parameters: {
          place_id: place_id,
          status: status,
          lastreport: lastreport
        }
      }
    });
  };

  service.updatePlace = function(place_id, place){
    return $http ({
      method: 'GET',
      url: Backand.getApiUrl() + '/1/query/data/updatePlace',
      params: {
        parameters: {
          description: place.description,
          price: place.price,
          facebook: place.facebook,
          facebook_id: place.facebook_id,
          place_id: place_id,
          website: place.website
        }
      }
    });
  };
  
  //get facebook long lived token
  service.getFacebookLongLivedToken = function(short_lived_token){
  	var response = $http ({
  		method: 'GET',
  		url: Backand.getApiUrl() + '/1/objects/action/places/?name=getLongLivedToken',
  		config: {
    		ignoreError: true
  		},
  		params: {
    		parameters: {
      			short_lived_token: short_lived_token
    		}	
  		}
	});
	
	return response;
	
  };




});

app.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  };
});

