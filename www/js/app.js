// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('starter', ['ionic'])

  .run(function ($ionicPlatform) {
    $ionicPlatform.ready(function () {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs).
      // The reason we default this to hidden is that native apps don't usually show an accessory bar, at
      // least on iOS. It's a dead giveaway that an app is using a Web View. However, it's sometimes
      // useful especially with forms, though we would prefer giving the user a little more room
      // to interact with the app.
      if (window.cordova && window.Keyboard) {
        window.Keyboard.hideKeyboardAccessoryBar(true);
      }

      if (window.StatusBar) {
        // Set the statusbar to use the default style, tweak this to
        // remove the status bar on iOS or change it to use white instead of dark colors.
        StatusBar.styleDefault();
      }
    });
  })
  .controller('TestController', function ($scope, VS2T4Service) {
    $scope.devices = [];
    $scope.device = {};
    $scope.scan = function scan() {
      console.debug('scan...');
      $scope.devices = [];
      VS2T4Service.scan().then(function (devices) {
        $scope.devices = devices;
        $scope.error = null;
      }, function (reason) {
        $scope.devices = [];
        $scope.error = JSON.stringify(reason);
      });
    };
    $scope.connect = function connect(device) {
      $scope.device = device;
      VS2T4Service.connect(device).then(function(){
        console.debug("device.connected: " + device.connected);
      });
    }
    $scope.disconnect = function disconnect(device) {
      VS2T4Service.disconnect(device);
    }
    // $scope.readVersion = function readVersion(device) {
    //   VS2T4Service.readVersion(device.id).then(function(data){
    //     console.debug(JSON.stringify(data));
    //     device.version = data;
    //   });
    // }
    $scope.readValue = function readValue(device) {
      VS2T4Service.readValue(device.id).then(function(data){
        console.debug(JSON.stringify(data));
        device.value_ = JSON.stringify(data);
      }, function(error) {
        alert(error);
      });
    }
  })
