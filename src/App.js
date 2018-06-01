import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import * as tf from '@tensorflow/tfjs';
import { encode, decode } from 'punycode';
import * as _ from 'lodash'

class App extends Component {
  constructor(props) {
    super(props);

    this.BODY_LENGTH = 30
    this.state = {
      body_text: '',
      ready: false,
      raw_tokenized: Array(this.BODY_LENGTH).fill(0)
    }

    this.handleBodyText = this.handleBodyText.bind(this)
  }

  async loadPretrainedModel(model_path) {
    try {
        const model = await tf.loadModel(model_path)

        return { model }
    } catch (err) {
        console.log('Load pretrained model failed:')
        console.error(err)
        return;  
    }
  }

  handleBodyText(e) {    
    const body_text = e.target.value
    this.setState({ body_text })

    if (!this.state.ready) {
      console.log('not ready')
      return;
    }

    // Generate raw_tokenized
    let split = [];
    let userText_tokenzied = [];
    let lines = body_text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const words = line.split(' ')
      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        split.push(word)
      }
    }
    for (let i = 0; i < split.length; i++) {
      const word = split[i];
      if (this.word2idx.hasOwnProperty(word)) {
        const idx = this.word2idx[word]
        userText_tokenzied.push(idx)
      }
    }
    
    console.log(userText_tokenzied)

    // Now pad it by BODY_LENGTH
    let raw_tokenized = Array(this.BODY_LENGTH).fill(0);
    if (userText_tokenzied.length > this.BODY_LENGTH) {
      raw_tokenized = userText_tokenzied.slice(0, this.BODY_LENGTH)
    } else {
      raw_tokenized = _.dropRight(raw_tokenized, userText_tokenzied.length).concat(userText_tokenzied)
    }

    this.setState({ raw_tokenized })
  }

  bootUp() {
    const p1 = this.loadPretrainedModel('model/model.json').then(({ model }) => {
      return { model }
    })

    const p2 = fetch( 'word_index.json' ).then(response => response.json()).then(data => {
      return { word2idx: data }
    })    

    return Promise.all([p1, p2])
  }

  componentDidMount(){    
    this.bootUp().then(values => {
      this.model = values[0].model;
      this.word2idx = values[1].word2idx;
      this.setState({ ready: true })
    })
  }

  render() {
    const {
      body_text
    } = this.state;

    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to React</h1>
        </header>
        <p className="App-intro">
          To get started, edit <code>src/App.js</code> and save to reload.
        </p>

        <textarea value={body_text} onChange={this.handleBodyText} cols="30" rows="10"></textarea>
      </div>
    );
  }
}

export default App;
