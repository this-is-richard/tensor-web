import React, { Component } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as _ from 'lodash'
import { div } from '@tensorflow/tfjs';
import { IMAGENET_CLASSES } from './IMAGENET_classes_zh';
import PredictionTable from './PredictionTable';

// other avaiable application-ready models: https://keras.io/applications/
const MOBILENET_PATH = 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json'
const IMAGE_SIZE = 224


class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      status_text: '',

      camReady: false,
      camAbsent: false,
      cams: null,

      mobilenetReady: false,

      image_src: null,

      predictions: [],
    }

    this.handleFileInput = this.handleFileInput.bind(this);
    this.handleVideo = this.handleVideo.bind(this);
    this.watchStream = this.watchStream.bind(this);
  }

  _video = (video) => {
    this.video = video
  }

  _canvas = (canvas) => {
    this.canvas = canvas
  }

  loadMobilenet() {
    console.log('loading mobilenet...')
    this.setState({ status_text: 'loading mobilenet...' })

    tf.loadModel(MOBILENET_PATH).then(model => {
      // const cutLayer = model.getLayer('conv_pw_13_relu');
      // this.mobilenet = tf.model({
      //   inputs: model.inputs,
      //   outputs: cutLayer.output
      // })
      this.mobilenet = model;
      this.mobilenet.predict(tf.zeros([1, 224, 224, 3])).print();
     
      console.log('mobilenet ready')
      this.setState({
        mobilenetReady: true,
        status_text: 'mobilenet ready !'
      })
    })    
  }

  capture(raw_img=null) {
    if (raw_img) {
      return tf.tidy(() => {
        const img = tf.fromPixels(raw_img); // [224, 224, 3]
        const batchedImg = img.expandDims(); // [1, 224, 224, 3]
        return batchedImg.toFloat().div(tf.scalar(255/2)).sub(tf.scalar(1))
      })
    } else {
      return tf.tidy(() => {
        const ctx = this.canvas.getContext('2d')
        this.canvas.height = IMAGE_SIZE
        this.canvas.width = IMAGE_SIZE

        let sx, sy;
        sx = this.video.videoWidth/2 - IMAGE_SIZE/2
        sy = this.video.videoHeight/2 - IMAGE_SIZE/2
        
        ctx.drawImage(this.video, 
          sx, sy,
          IMAGE_SIZE, IMAGE_SIZE,
          0, 0, IMAGE_SIZE, IMAGE_SIZE)

        const img = tf.fromPixels(this.canvas); // [224, 224, 3]
        const batchedImg = img.expandDims(); // [1, 224, 224, 3]
        return batchedImg.toFloat().div(tf.scalar(255/2)).sub(tf.scalar(1))                
      })
    }    
  }

  handleFileInput(e) {
    let files = e.target.files;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.match('image.*')) {
        continue
      }
      let reader = new FileReader();
      reader.onload = e => {
        this.setState({ image_src: e.target.result })

        // create img element
        let img = document.createElement('img');
        img.src = e.target.result;
        img.width = IMAGE_SIZE;
        img.height = IMAGE_SIZE;
        img.onload = () => {
          this.predict(img)
        }
      };
      reader.readAsDataURL(f);
    }
  }

  watchStream() {
    this.streaming = setInterval(() => {
      this.predict();
    }, 800)
  }

  handleVideo(stream) {
    // stream video
    this.video.srcObject = stream;

    this.setState({ camReady: true })
    this.watchStream()
  }

  handleVideoError(err) {
    console.warn(err)
  }

  setUpWebCam() {
    // get cam list
    navigator.mediaDevices.enumerateDevices()
      .then(dvs => {
        const cams = dvs.filter(d => d.kind === 'videoinput')
        if(cams.length === 0) {
          console.log('videoinput absent')
          this.setState({ camAbsent: true })
          return
        }
        // store list of cams to state
        this.setState({ cams })
      })
      .catch(err => console.warn(err))

    // get cam stream
    navigator.getUserMedia = navigator.getUserMedia || 
                              navigator.webkitGetUserMedia || 
                              navigator.mozGetUserMedia || 
                              navigator.msGetUserMedia || 
                              navigator.oGetUserMedia;
    if(!navigator.getUserMedia) {
      console.log('getUserMedia absent')
      this.setState({ camAbsent: true })
      return
    }
    const options = { video: true }
    navigator.getUserMedia(options, this.handleVideo, this.handleVideoError);
  }

  async predict(raw_img=null) {
    if (!this.state.mobilenetReady) {
      console.log('mobilenet not ready')
      return
    }

    const img = this.capture(raw_img);
    this.mobilenet.predict(img).data().then(values => {
      let classProb = []
      for (let i = 0; i < values.length; i++) {
        const prob = values[i];
        const classIdx = i
        classProb.push({ classIdx, prob })
      }
  
      // sort by prob, get top 3
      classProb = _.sortBy(classProb, ['prob']).reverse()
      let topThree = classProb.slice(0, 3)
  
      // get class name by classIdx
      topThree = topThree.map(obj => {
        obj.name = IMAGENET_CLASSES[obj.classIdx]
        return obj
      })
  
      this.setState({ predictions: topThree })
    })
  }

  componentDidMount() {
    this.setUpWebCam()
    this.loadMobilenet();

    window.tf = tf
  }

  render() {
    const {
      image_src,
      status_text,
      predictions,
      camAbsent
    }  = this.state
    return (
      <div>
        <div className="jumbotron">
          <h1 className="display-4">Image classification</h1>
          <p className="lead">Learn to name everyday objects</p>
          <span className='ml-2'>{status_text}</span>
        </div>

        <div className="container">
          <div className="row">
            {camAbsent && <div className="input-group mb-3 col-12">
              <div className="custom-file">
                <input onChange={this.handleFileInput} type="file" className="custom-file-input" id="inputGroupFile02" />
                <label className="custom-file-label" htmlFor="inputGroupFile02">Choose file</label>
              </div>
              <div className="input-group-append">
                <span className="input-group-text" id="">Upload</span>
              </div>              
            </div>}

            {image_src && <div className="text-center col-6"><img src={image_src} className="img-thumbnail" alt="Responsive image" /></div>}
            
            {predictions.length > 0 && <PredictionTable predictions={predictions} />}

            <canvas ref={this._canvas} width={IMAGE_SIZE} height={IMAGE_SIZE}></canvas>
            <video id='webcam' autoPlay="true" ref={this._video} ></video>
            
          </div>
        </div>
      </div>
    );
  }
}

export default App;
