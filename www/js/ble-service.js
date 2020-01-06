'use strict';

angular.module('starter')
  .service('VS2T4Service', function ($q) {
    var ble_uuid = {
      READ: '0000fff1-0000-1000-8000-00805f9b34fb',
      WRITE: '0000fff2-0000-1000-8000-00805f9b34fb',
      SERVICE: '0000fff0-0000-1000-8000-00805f9b34fb'
    };

    // TODO: 检查权限
    function scan(uuid) {
      return new $q(function (resolve, reject) {
        var devices = [];
        var uuids = uuid ? [uuid] : [];
        ble.startScan(uuids, function (device) {
          console.log(JSON.stringify(device));
          if (device.name === "VS2T4") {
            devices.push(device);
          }
        }, function (reason) {
          reject(reason);
        });
        setTimeout(ble.stopScan,
          2000,
          function () {
            console.log("Scan complete");
            if (devices.length > 0) {
              resolve(devices);
            }
            resolve(devices);
          },
          function (reason) {
            console.log("stopScan failed");
            reject(reason);
          }
        );
      });
    }

    function connect(device) {
      var id = device.id;
      var q = $q.defer();
      try {
        ble.isConnected(id, function (data) {
          device.connected = true;
          q.resolve("is connected");
        }, function () {
          ble.autoConnect(id, function (data) {
            device.connected = true;
            console.debug("connected");
            q.resolve(data);
          }, function (data) {
            console.debug("ble disconnected %s", data);
            // 还用 stopNotification 吗？不用了吧，都连不上了。
            device.connected = false;
          });
        });
      } catch (error) {
        q.reject(error);
      }
      return q.promise;
    }

    function disconnect(device) {
      var id = device.id;
      var q = $q.defer();
      try {
        ble.isConnected(id, function (data) {
          console.debug("isconnected: " + data);
          stopNotification(id);
          ble.disconnect(id, function (data) {
            device.connected = false;
            q.resolve(data);
          }, function (error) {
            console.error("disconnect error: " + JSON.stringify(error));
            // 有时候设备已经完成断开连接了，但是会到这里，权当是正常的吧。
            // q.reject(error);
            device.connected = false;
            q.resolve("disconnect");
          });
        }, function (data) {
          q.reject(data);
        });
      } catch (error) {
        q.reject(error);
      }
      return q.promise;
    }

    function startNotification(id, once) {
      return new $q(function (resolve, reject) {
        ble.startNotification(id, ble_uuid.SERVICE, ble_uuid.READ, function (buffer) {
          var data = new Uint8Array(buffer);
          console.debug("notification result: %s", bufferArrayToHex(data));
          // if (once) {
          //   stopNotification(id);
          // }
          resolve(data);
        }, function (error) {
          console.error("notification ERROR: %s", JSON.stringify(error));
          reject(error);
        });
      });
    }

    function stopNotification(id) {
      ble.stopNotification(id, ble_uuid.SERVICE, ble_uuid.READ, function (data) {
        console.debug("stopNotification: %s", JSON.stringify(data));
      }, function (error) {
        console.error("stopNotification ERROR: %s", JSON.stringify(error));
      });
    }

    // function readVersion(id) {
    //   var data = new Uint8Array(5);
    //   data[0] = 0xbb; // prefix
    //   data[1] = 0; // size
    //   data[2] = 2; // size
    //   data[3] = 0xa0; // command
    //   return getValue(id, data);
    // }

    function readValue(id) {
      var data = new Uint8Array(5);
      data[0] = 0xbb; // prefix
      data[1] = 0; // size
      data[2] = 2; // size
      data[3] = 0xa1; // command 4.2	获取结果值
      return getValue(id, data);
    }

    function round(number, precision) {
      return Math.round(+number + 'e' + precision) / Math.pow(10, precision);
      //same as:
      //return Number(Math.round(+number + 'e' + precision) + 'e-' + precision);
    }

    function getValue(id, data) {
      var q = $q.defer();
      addChecksum(data);
      // 使用 read 往往读取的不是最新的数据，因此使用 notification 的方式获取数据
      startNotification(id, true).then(function (data) {
        if (isValid(data)) {
          var value = parseValue(data);
          q.resolve(value);
        }
        else {
          q.reject("数据校验失败，请重试");
        }
      }, function (error) {
        q.reject(error);
      });
      ble.write(id, ble_uuid.SERVICE, ble_uuid.WRITE, data.buffer, function (data) {
        console.debug("write result: %s", JSON.stringify(data));
      }, function (reason) {
        q.reject(reason);
      });
      return q.promise;
    }

    var power_level = {
      0xf0: "100%",
      0xf1: "75%",
      0xf2: "50%",
      0xf3: "25%",
      0xf4: "0%",
    };

    function parseValue(data) {
      var command = data[3];
      var value = {};
      var status_ = data[4];
      if (status_ === 0x1) { // 表示读取失败
        value.success = false
        return value;
      }
      value.power = power_level[status_];
      console.debug("command: %s", command);

      switch (command) {
        case 0xa1: // 数据值 Status(1B) +灵敏度(2B) +加速度值(2B)+速度值（2B）+位移值（2B）+温度值（2B）
          value.sensitivity = round(getWordValue(data, 5) / 100, 2); // 灵敏度
          value.acceleration = round(getWordValue(data, 7) / 10, 2); // 加速度值(m/s2)
          value.velocity = round(getWordValue(data, 9) / 10, 2); // 速度值(mm/s)
          value.offset = getWordValue(data, 11); // 位移值(um)
          value.temperature = round(getWordValue(data, 13) * 0.02 - 273.15, 2); // 温度（摄氏度）
          break;
        default:
          throw new Error("UNSUPPORTED comand: " + toHexString(command));
      }
      return value;
    }

    function getWordValue(data, index) {
      if (index >= data.length) {
        throw new Error("index out of bound");
      }
      // console.debug("data[index]="+data[index]+", data[index+1]="+data[index+1]);
      var value = (data[index] << 8) + data[index + 1];
      // console.debug("<<8 " + (data[index] << 8));
      // console.debug("*256 " + (data[index] * 256));
      // console.debug("word value: " + value);
      return value;
    }

    function addChecksum(data) {
      data[data.byteLength - 1] = checksum(data);
    }

    function checksum(data) {
      var idx = data.byteLength - 1;
      var checksum = 0;
      for (var i = 3; i < idx; i++) {
        checksum = data[i] ^ checksum;
      }
      return checksum;
    }

    function isValid(data) {
      console.debug(data.length);
      if (data.length <= 6) { // 返回的数据格式为：前导码(1B) + 长度(2B) + 命令码(1B) + 状态码(1B) + 数据(nB) + 校验码(1B)，前导码+长度+命令码+状态码+校验码 至少6个字节
        return false;
      }
      if (data[0] != 0xbb) { // 前导码 不正确
        return false;
      }
      var checksum_ = data[data.byteLength - 1];
      var expected = checksum(data);
      console.debug("actual: %s, expected: %s", checksum_, expected);
      return checksum_ === expected;
    }

    // function bytesToString(buffer) {
    //   return String.fromCharCode.apply(null, new Uint8Array(buffer));
    // }

    function bufferToHex(buffer) {
      var buffer_ = new Uint8Array(buffer);
      var data_ = [];
      for (var idx = 0; idx < buffer_.byteLength; idx++) {
        data_.push(toHexString(buffer_[idx]));
      }
      return data_;
    }

    function bufferArrayToHex(bufferArray) {
      var data_ = [];
      for (var idx = 0; idx < bufferArray.byteLength; idx++) {
        data_.push(toHexString(bufferArray[idx]));
      }
      return data_;
    }

    function toHexString(num) {
      return num.toString(16).padStart(2, "0");
    }

    return {
      scan: scan,
      readValue: readValue,
      connect: connect,
      disconnect: disconnect
    }
  });