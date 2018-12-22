import AudioContext from './AudioContext';

let analyser;
let audioCtx;
let mediaRecorder;
let chunks = [];
let startTime;
let stream;
let mediaOptions;
let blobObject;
let onStartCallback;
let onStopCallback;
let onSaveCallback;
let onDataCallback;
let onDataPcmCallback;

const constraints = { audio: true, video: false }; // constraints - only audio needed

navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

export class MicrophoneRecorder {
  constructor(onStart, onStop, onSave, onData, onDataPcm, options) {
    onStartCallback= onStart;
    onStopCallback = onStop;
    onSaveCallback = onSave;
    onDataCallback = onData;
    onDataPcmCallback = onDataPcm;
    mediaOptions = options;
  }

  startRecording = () => {

    startTime = Date.now();

    if(mediaRecorder) {

      if(audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      if(mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        return;
      }

      if(audioCtx && mediaRecorder && mediaRecorder.state === 'inactive') {
        mediaRecorder.start(10);
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        if(onStartCallback) { onStartCallback() };
      }
    } else {
      if (navigator.mediaDevices) {
        console.log('getUserMedia supported.');

        navigator.mediaDevices.getUserMedia(constraints)
          .then((str) => {
            stream = str;

            if(MediaRecorder.isTypeSupported(mediaOptions.mimeType)) {
              mediaRecorder = new MediaRecorder(str, mediaOptions);
            } else {
              mediaRecorder = new MediaRecorder(str);
            }

            if(onStartCallback) { onStartCallback() };

            mediaRecorder.onstop = this.onStop;
            mediaRecorder.ondataavailable = (event) => {
              chunks.push(event.data);
              if(onDataCallback) {
                onDataCallback(event.data);
              }
            }

            audioCtx = AudioContext.getAudioContext();
            analyser = AudioContext.getAnalyser();

            audioCtx.resume();
            mediaRecorder.start(10);

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            if (onDataPcmCallback) {
              const processor = audioCtx.createScriptProcessor(2048, 1, 1);
              processor.connect(audioCtx.destination);
              source.connect(processor);

              source.onended = () => {
                source.disconnect(processor);
                processor.disconnect(audioCtx.destination);
              }
              
              processor.onaudioprocess = (evt) => {
                var left = evt.inputBuffer.getChannelData(0);
                var left16 = downsampleBuffer(left, 44100, 16000)
                onDataPcmCallback(left16)
              };
            }
          });

      } else {
        alert('Your browser does not support audio recording');
      }
    }

  }

  stopRecording() {
    if(mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();

      stream.getAudioTracks().forEach((track) => {
        track.stop()
      })

      mediaRecorder = null

      audioCtx.suspend();
    }
  }

  onStop(evt) {
    const blob = new Blob(chunks, { 'type' : mediaOptions.mimeType });
    chunks = [];

    const blobObject =  {
      blob      : blob,
      startTime : startTime,
      stopTime  : Date.now(),
      options   : mediaOptions,
      blobURL   : window.URL.createObjectURL(blob)
    }

    if(onStopCallback) { onStopCallback(blobObject) };
    if(onSaveCallback) { onSaveCallback(blobObject) };
  }

}

let downsampleBuffer = function(buffer, sampleRate, outSampleRate) {
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
      var accum = 0, count = 0;
      for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
          accum += buffer[i];
          count++;
      }

      result[offsetResult] = Math.min(1, accum / count)*0x7FFF;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
  }
  return result.buffer;
}
