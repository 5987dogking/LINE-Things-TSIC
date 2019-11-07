var USER_SERVICE_UUID = '9cfc60ec-4b8d-48aa-b089-4a56ca7ccab3'; // serviceUuid
const PSDI_SERVICE_UUID = 'e625601e-9e55-4597-a598-76018a0d293d'; // psdiServiceUuid
const PSDI_CHARACTERISTIC_UUID = '26e2b12b-85f0-4f3f-9fdd-91d114270e6e';// psdiCharacteristicUuid
const LED_CHARACTERISTIC_UUID = 'E9062E71-9E62-4BC6-B0D3-35CDCD9B027B';
const BTN_CHARACTERISTIC_UUID = '62FBD229-6EDD-4D1A-B554-5C4E1BB29169';

let ledState = false; // true: LED on, false: LED off
let clickCount = 0;

// -------------- //
// On window load //
// -------------- //
// document.getElementById("btn-led-toggle").addEventListener("click",handlerToggleLed);

window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryLiffId = urlParams.get('liffId');
    const queryUS_UUID = urlParams.get('USER_SERVICE_UUID');
    window.USER_SERVICE_UUID = (queryUS_UUID !== null) ? queryUS_UUID : window.USER_SERVICE_UUID;
    window.app.liffId = (queryLiffId !== null) ? queryLiffId : window.app.liffId;
    initializeApp();
    modalEle = document.getElementById('modal1')
    modal = M.Modal.init(modalEle, { dismissible: false });
    const btn_connect = document.getElementById("btn-connect");
    btn_connect.addEventListener("click", setWIFI);
    document.getElementById("refreshWIFIBtn").addEventListener("click", refreshWIFI);
    window.displayName = ''
    window.pictureUrl = ''
};

// ----------------- //
// Handler functions //
// ----------------- //
function handlerToggleLed() {
    ledState = !ledState;
    axios.post(process.env.UNLOCK_API, {
        userName: window.displayName,
        userPic: window.pictureUrl
    }).then(function (response) {
        console.log(response);
    }).catch(function (error) {
        console.log(error);
    });
}

// ------------ //
// UI functions //
// ------------ //

function uiToggleDeviceConnected(connected) {
    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");
    elStatus.classList.remove("error");
    if (connected) {
        // Hide loading animation
        uiToggleLoadingAnimation(false);
        // const btn_led = document.getElementById("btn-led-toggle")
        // btn_led.addEventListener("click", handlerToggleLed)
        // Show status connected
        elStatus.classList.remove("inactive");
        elStatus.classList.add("success");
        elStatus.innerText = "Device connected";
        // Show controls
        elControls.classList.remove("hidden");
        // setTimeout(() => {
        //     getModel();
        // }, 1000);
    } else {
        // Show loading animation
        uiToggleLoadingAnimation(true);
        // Show status disconnected
        elStatus.classList.remove("success");
        elStatus.classList.add("inactive");
        elStatus.innerText = "Device disconnected";
        // Hide controls
        elControls.classList.add("hidden");
    }
}

function uiToggleLoadingAnimation(isLoading) {
    const elLoading = document.getElementById("loading-animation");
    if (isLoading) {
        // Show loading animation
        elLoading.classList.remove("hidden");
    } else {
        // Hide loading animation
        elLoading.classList.add("hidden");
    }
}

function uiStatusError(message, showLoadingAnimation) {
    errorList = {
        'Failed to init LIFF SDK': 'LINE載入失敗',
        'Current environment is not supported. Please open it with LINE': '請使用LINE應用程式。',
        'Could not authenticate LIFF app': '請使用LINE應用程式。',
        'There are no linked devices.': '藍牙未連線。',
        'Failed to connect to device.': '藍牙連線失敗，請重新操作。',
        'The device is already connected.': '藍牙已連線。',
        'The device has been disconnected.': '藍牙已斷線。',
        'The operation is not supported on this characteristic.': '藍牙發生錯誤。',
        'The service is not found in the GATT server.': '藍牙發生錯誤。',
        'The characteristic is not found in the service.': '藍牙發生錯誤。',
    };
    uiToggleLoadingAnimation(showLoadingAnimation);
    console.log('uiStatusError', message, showLoadingAnimation);
    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");
    // Show status error
    elStatus.classList.remove("success");
    elStatus.classList.remove("inactive");
    elStatus.classList.add("error");
    elStatus.innerText = message;
    errorText = message.split('\n')[2];
    if (errorList[errorText] !== undefined) {
        elStatus.innerText = errorList[errorText] + '(' + errorText + ')';
    }
    app.bluetooth = (message.split('\n')[1] === 'BLUETOOTH_ALREADY_CONNECTED');
    // Hide controls
    elControls.classList.add("hidden");
}

function makeErrorMsg(errorObj) {
    return "Error\n" + errorObj.code + "\n" + errorObj.message;
}

// -------------- //
// LIFF functions //
// -------------- //

function initializeApp() {
    if (location.hostname === '') {
        window.app.profile = {
            userId: "Ud1d085be5a554acca6a6bb3f5a496bfc",
            displayName: "劉振維",
            pictureUrl: "https://profile.line-scdn.net/0htukRqtJpK1pWKwRa2BxUDWpuJTchBS0SLkszbHcpIjh-SGoJOEptb3p5fG4sEm5fbUllOXsuJmx6",
            statusMessage: "􀠁􀅶Quotation marks left􏿿 I'm a Hello World Engineer􀠁􀅷Quotation marks right􏿿",
        };
    }
    liff.init({ liffId: window.app.liffId }).then(() => { initializeLiff() }).catch((err) => {
        console.log('init err');
        uiStatusError(makeErrorMsg(error), false)
    });
}

function initializeLiff() {
    liff.initPlugins(['bluetooth']).then(() => {
        liffCheckAvailablityAndDo(() => liffRequestDevice());
    }).catch(error => {
        console.log('initializeLiff err');
        uiStatusError(makeErrorMsg(error), false);
    });
    liff.getProfile().then(profile => {
        window.displayName = profile.displayName
        window.pictureUrl = profile.pictureUrl
        window.app.profile = profile;
        console.log('profile', profile);
    }).catch((err) => {
        console.log('error', err);
    });
}

function liffCheckAvailablityAndDo(callbackIfAvailable) {
    // Check Bluetooth availability
    liff.bluetooth.getAvailability().then(isAvailable => {
        if (isAvailable) {
            uiToggleDeviceConnected(false);
            callbackIfAvailable();
        } else {
            console.log('liffCheckAvailablityAndDo', callbackIfAvailable);
            uiStatusError("Bluetooth not available", true);
            setTimeout(() => liffCheckAvailablityAndDo(callbackIfAvailable), 10000);
        }
    }).catch(error => {
        console.log('liffCheckAvailablityAndDo catch', callbackIfAvailable);
        uiStatusError(makeErrorMsg(error), false);
    });;
}

function liffRequestDevice() {
    liff.bluetooth.requestDevice().then(device => {
        liffConnectToDevice(device);
    }).catch(error => {
        console.log('liffRequestDevice');
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffConnectToDevice(device) {
    device.gatt.connect().then(() => {
        // document.getElementById("device-name").innerText = device.name;
        // document.getElementById("device-id").innerText = device.id;
        // Show status connected
        uiToggleDeviceConnected(true);
        // Get service
        device.gatt.getPrimaryService(USER_SERVICE_UUID).then(service => {
            liffGetUserService(service);
        }).catch(error => {
            console.log('liffConnectToDevice getPrimaryService(USER_SER', device);
            uiStatusError(makeErrorMsg(error), false);
        });
        device.gatt.getPrimaryService(PSDI_SERVICE_UUID).then(service => {
            liffGetPSDIService(service);
        }).catch(error => {
            console.log('liffConnectToDevice getPrimaryService(PSDI_S', device);
            uiStatusError(makeErrorMsg(error), false);
        });
        // Device disconnect callback
        const disconnectCallback = () => {
            // Show status disconnected
            uiToggleDeviceConnected(false);
            // Remove disconnect callback
            device.removeEventListener('gattserverdisconnected', disconnectCallback);
            // Reset LED state
            ledState = false;
            // Try to reconnect
            initializeLiff();
        };
        device.addEventListener('gattserverdisconnected', disconnectCallback);
    }).catch(error => {
        console.log('liffConnectToDevice catch', device);
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetUserService(service) {
    // Button pressed state
    service.getCharacteristic(BTN_CHARACTERISTIC_UUID).then(characteristic => {
        // liffGetButtonStateCharacteristic(characteristic);
        try {
            setTimeout(() => {
                liffGetButtonStateCharacteristic(characteristic);
            }, 500);
        } catch (error) {
            liffGetUserService(service);
        }
    }).catch(error => {
        console.log('liffGetUserService', service);
        uiStatusError(makeErrorMsg(error), false);
    });

    // Toggle LED
    service.getCharacteristic(LED_CHARACTERISTIC_UUID).then(characteristic => {
        window.ledCharacteristic = characteristic;
        // Switch off by default

    }).catch(error => {
        console.log('liffGetUserService catch', service);
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetPSDIService(service) {
    // Get PSDI value
    service.getCharacteristic(PSDI_CHARACTERISTIC_UUID).then(characteristic => {
        return characteristic.readValue();
    }).then(value => {
        // Byte array to hex string
        const psdi = new Uint8Array(value.buffer)
            .reduce((output, byte) => output + ("0" + byte.toString(16)).slice(-2), "");
        // document.getElementById("device-psdi").innerText = psdi;
    }).catch(error => {
        console.log('liffGetPSDIService');
        setTimeout(() => {
            alert('發生錯誤，請清除LINE Things我的裝置列表，然後重新連線。');
            liff.closeWindow();
        }, 1500);
        uiStatusError(makeErrorMsg(error), false);
    });
}

var dataString = '';
var dataObj = {};
var uint8arrayStringHistory = '';
var reTryCount = 0;
function liffGetButtonStateCharacteristic(characteristic) {
    // Add notification hook for button state
    // (Get notified when button state changes)
    characteristic.startNotifications().then(() => {
        characteristic.addEventListener('characteristicvaluechanged', e => {
            const val = (new Uint8Array(e.target.value.buffer))[0];
            const uint8array = new Uint8Array(e.target.value.buffer);
            const uint8arrayString = new TextDecoder("utf-8").decode(uint8array);
            console.log('BTL Get =>', uint8arrayString);
            if (uint8arrayString === 'BTLend' && uint8arrayStringHistory !== 'BTLend') {
                try {
                    dataObj = JSON.parse(dataString);
                    switch (window.app.dataMode) {
                        case 'refreshWifi':
                            window.app.wifiList = dataObj.data;
                            break;
                        case 'getModel':
                            window.app.model = dataObj.model;
                            window.app.saveModel();
                            setTimeout(() => {
                                refreshWIFI();
                            }, 500);
                            break;
                        case 'setWifi':
                            if (dataObj.status == 3) {
                                window.app.wifiStatus.isConnect = true;
                                alert('WIFI 連線成功');
                            } else {
                                alert('WIFI 連線失敗，請檢查密碼或重新嘗試。');
                            }
                            break;
                        default:
                            break;
                    }
                    dataString = '';
                    window.modal.close();
                    reTryCount = 0;
                } catch (error) {
                    console.log('JSON.parse(dataString) GG', error);
                    console.log('dataString =>', dataString);
                    dataString = '';
                    window.modal.close();
                    reTryCount++;
                    if (reTryCount !== 3) {
                        setTimeout(() => {
                            switch (window.app.dataMode) {
                                case 'refreshWifi':
                                    refreshWIFI();
                                    break;
                                case 'getModel':
                                    getModel()
                                    break;
                                case 'setWifi':
                                    setWIFI();
                                    break;
                                default:
                                    break;
                            }
                        }, 750);
                    } else {
                        reTryCount = 0;
                        if (window.app.dataMode === 'getModel') {
                            alert('LINE出現狀況，建議使用手動輸入WIFI帳號及密碼。');
                        } else {
                            alert('LINE出現狀況，藍芽接收發生錯誤，請重新嘗試。');
                        }
                    }
                }
            } else {
                if (uint8arrayStringHistory !== uint8arrayString) {
                    dataString += uint8arrayString;
                }
            }
            uint8arrayStringHistory = uint8arrayString;
        });
        setTimeout(() => {
            getModel();
        }, 500);
    }).catch(error => {
        console.log('liffGetButtonStateCharacteristic', error);
        setTimeout(() => {
            alert('發生錯誤，請清除LINE Things我的裝置列表，然後重新連線。');
            liff.closeWindow();
        }, 1500);
        uiStatusError(makeErrorMsg(error), false);
    });

}

var demoData = { "data": [{ "SSID": "Test WIFI" }] };

function setWIFI() {
    console.log('setWIFI Function Go');
    obj = {
        mode: 'setWifi',
        SSID: app.wifiConfig.SSID,
        password: app.wifiConfig.password,
    };
    BTLsend(obj);
}

function refreshWIFI() {
    console.log('refreshWIFI Function Go');
    obj = { mode: 'refreshWifi' };
    BTLsend(obj);
}

function getModel() {
    console.log('getModel Function Go');
    obj = { mode: 'getModel' };
    BTLsend(obj);
}

let loadingTextZh = {
    refreshWifi: 'WIFI掃描中..',
    getModel: '取得型號中...',
    setWifi: 'WIFI設定中...',
};

function BTLsend(obj) {
    window.modal.open();
    if (location.hostname === '') {
        setTimeout(() => {
            window.modal.close();
        }, 2000);
        return;
    }
    window.app.dataMode = obj.mode;
    window.app.loadingText = loadingTextZh[obj.mode];
    const enc = new TextEncoder(); // always utf-8
    const postText = JSON.stringify(obj);
    const postTextUtf8 = enc.encode(postText);
    try {
        window.ledCharacteristic.writeValue(postTextUtf8).catch(error => {
            console.log('BTLsend uiStatusError');
            uiStatusError(makeErrorMsg(error), false);
        });
    } catch (error) {
        console.log('送出失敗', error);
        alert('送出失敗');
    }
}

function mkBTL() {
    const filterName = 'LINE@百葉箱';
    let filters = [{ name: filterName }];
    let options = {};
    options.filters = filters;
    navigator.bluetooth.requestDevice(options)
        .then(device => {
            console.log('> Name:             ' + device.name);
            console.log('> Id:                 ' + device.id);
            console.log('> Connected:        ' + device.gatt.connected);
        })
        .catch(error => { console.log(error); });
}