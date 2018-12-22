'use strict';

exports.__esModule = true;
exports.MicrophoneRecorder = undefined;

var _AudioContext = require('./AudioContext');

var _AudioContext2 = _interopRequireDefault(_AudioContext);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var analyser = void 0;
var audioCtx = void 0;
var mediaRecorder = void 0;
var chunks = [];
var startTime = void 0;
var stream = void 0;
var mediaOptions = void 0;
var blobObject = void 0;
var onStartCallback = void 0;
var onStopCallback = void 0;
var onSaveCallback = void 0;
var onDataCallback = void 0;
var onDataPcmCallback = void 0;

var constraints = { audio: true, video: false }; // constraints - only audio needed

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

var MicrophoneRecorder = exports.MicrophoneRecorder = function () {
  function MicrophoneRecorder(onStart, onStop, onSave, onData, onDataPcm, options) {
    var _this = this;

    _classCallCheck(this, MicrophoneRecorder);

    this.startRecording = function () {

      startTime = Date.now();

      if (mediaRecorder) {

        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }

        if (mediaRecorder && mediaRecorder.state === 'paused') {
          mediaRecorder.resume();
          return;
        }

        if (audioCtx && mediaRecorder && mediaRecorder.state === 'inactive') {
          mediaRecorder.start(10);
          var source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          if (onStartCallback) {
            onStartCallback();
          };
        }
      } else {
        if (navigator.mediaDevices) {
          console.log('getUserMedia supported.');

          navigator.mediaDevices.getUserMedia(constraints).then(function (str) {
            stream = str;

            if (MediaRecorder.isTypeSupported(mediaOptions.mimeType)) {
              mediaRecorder = new MediaRecorder(str, mediaOptions);
            } else {
              mediaRecorder = new MediaRecorder(str);
            }

            if (onStartCallback) {
              onStartCallback();
            };

            mediaRecorder.onstop = _this.onStop;
            mediaRecorder.ondataavailable = function (event) {
              chunks.push(event.data);
              if (onDataCallback) {
                onDataCallback(event.data);
              }
            };

            audioCtx = _AudioContext2.default.getAudioContext();
            analyser = _AudioContext2.default.getAnalyser();

            audioCtx.resume();
            mediaRecorder.start(10);

            var source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            if (onDataPcmCallback) {
              var processor = audioCtx.createScriptProcessor(2048, 1, 1);
              processor.connect(audioCtx.destination);
              source.connect(processor);

              source.onended = function () {
                source.disconnect(processor);
                processor.disconnect(audioCtx.destination);
              };

              processor.onaudioprocess = function (evt) {
                var left = evt.inputBuffer.getChannelData(0);
                var left16 = downsampleBuffer(left, 44100, 16000);
                onDataPcmCallback(left16);
              };
            }
          });
        } else {
          alert('Your browser does not support audio recording');
        }
      }
    };

    onStartCallback = onStart;
    onStopCallback = onStop;
    onSaveCallback = onSave;
    onDataCallback = onData;
    onDataPcmCallback = onDataPcm;
    mediaOptions = options;
  }

  MicrophoneRecorder.prototype.stopRecording = function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();

      stream.getAudioTracks().forEach(function (track) {
        track.stop();
      });

      mediaRecorder = null;

      audioCtx.suspend();
    }
  };

  MicrophoneRecorder.prototype.onStop = function onStop(evt) {
    var blob = new Blob(chunks, { 'type': mediaOptions.mimeType });
    chunks = [];

    var blobObject = {
      blob: blob,
      startTime: startTime,
      stopTime: Date.now(),
      options: mediaOptions,
      blobURL: window.URL.createObjectURL(blob)
    };

    if (onStopCallback) {
      onStopCallback(blobObject);
    };
    if (onSaveCallback) {
      onSaveCallback(blobObject);
    };
  };

  return MicrophoneRecorder;
}();

var downsampleBuffer = function downsampleBuffer(buffer, sampleRate, outSampleRate) {
  if (outSampleRate == sampleRate) {
    return buffer;
  }
  if (outSampleRate > sampleRate) {
    throw "downsampling rate show be smaller than original sample rate";
  }
  var sampleRateRatio = sampleRate / outSampleRate;
  var newLength = Math.round(buffer.length / sampleRateRatio);
  var result = new Int16Array(newLength);
  var offsetResult = 0;
  var offsetBuffer = 0;
  while (offsetResult < result.length) {
    var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    var accum = 0,
        count = 0;
    for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result.buffer;
};