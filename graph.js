/* global Chart */

'use strict';

var Graph = function(canvas) {
  let adaChart;
  let plotType;
  
  this.chart = canvas.getContext('2d');
  this.maxBufferSize = 100;
  
  this.XTConfig = {
    type: 'line', // make it a line chart
    data: {
      labels: [],
      datasets: []
    },
    options: {
      elements: {
        line: {
          tension: 0,
          fill: false
        },
      },
      animation: {
        duration: 0
      },
      hover: {
        enabled: false
      },
      tooltips: {
        enabled: false
      },
      maintainAspectRatio: false,
      scales: {
        xAxes: [{
          type: 'time',
          bounds: 'data',
          distribution: 'series',
          gridLines: {
            drawOnChartArea: false,
          },
          ticks: {
            display: false,
          },
        }],
        yAxes: [{
          ticks: {
            maxRotation: 0
          }
        }]
      },
      maintainAspectRatio: false,
    }
  };

  this.XYConfig = {
    type: 'scatter', // make it a scatter chart
    data: {
      labels: [],
      datasets: []
    },
    options: {
      elements: {
        line: {
          tension: 0,
          fill: false
        },
      },
      animation: {
        duration: 0
      },
      hover: {
        enabled: false
      },
      tooltips: {
        enabled: false
      },
      maintainAspectRatio: false,
      scales: {
        xAxes: [{
          type: 'linear',
          bounds: 'data',
          distribution: 'series',
          ticks: {
            display: true,
          },
        }],
        yAxes: [{
          ticks: {
            maxRotation: 0
          }
        }]
      },
    }
  };
}

Graph.prototype = {
  create: function (plotType) {
    if (this.plotType == undefined) {
      if (plotType != undefined) {
        this.setPlotType(plotType);       
      } else {
        this.plotType = "xt";       
      }
    } else if (plotType != undefined) {
      this.setPlotType(plotType);       
    }

    // Remove any existing chart
    if (this.adaChart != undefined) {
      this.adaChart.destroy();
      delete this.adaChart;
    }
    let config = this.getConfig();
    this.adaChart = new Chart(this.chart, config);
    this.resize();
  },
  getConfig: function() {
    if (this.plotType == 'xy') {
      return this.XYConfig;
    } else {
      return this.XTConfig;
    }  
  },
  setPlotType: function(type) {
    if (type.toLowerCase() == "xy") {
      this.plotType = "xy";
    } else {
      this.plotType = "xt";
    }
  },
  updateLabelColor: function(color) {
    this.adaChart.options.scales.xAxes[0].ticks.fontColor = color;
    this.adaChart.options.scales.yAxes[0].ticks.fontColor = color;
    this.adaChart.update();    
  },
  reset: function() {
    // Clear the data
    let dataSetLength = this.adaChart.data.datasets.length;
    for(let i = 0; i < dataSetLength; i++) {
      this.adaChart.data.datasets.pop();
    }
    this.adaChart.update();
  },
  addDataSet: function(label, color) {
    let dataConfig;
    if (this.plotType == 'xy') {
      dataConfig = {
        label: label,
        data: [],
        borderColor: color,
        borderWidth: 1,
        pointBackgroundColor: color,
        pointBorderColor: color,
        pointRadius: 5,
        pointHoverRadius: 5,
        fill: false,
        tension: 0,
        showLine: false
      }
    } else {
      dataConfig = {
        label: label,
        data: [],
        borderColor: color,
        borderWidth: 1,
        pointRadius: 0
      }
    }
    this.adaChart.data.datasets.push(dataConfig);
  },
  update: function() {
    this.adaChart.update();
  },
  resize: function() {
    if (this.plotType == 'xy') {
      this.chart.canvas.parentNode.style.width = '40vh';
    } else {
      this.chart.canvas.parentNode.style.width = '100%';    
    }    
  },
  addValue: function(dataSetIndex, value) {
    if (this.plotType == 'xy' && Array.isArray(value)) {
      this.adaChart.data.datasets[dataSetIndex].data.push({
        x: value[0],
        y: value[1]
      });
    } else if (this.plotType == 'xt') {
      let time = new Date();
      this.adaChart.data.datasets[dataSetIndex].data.push({
        t: time,
        y: value
      });
    }
    this.flushBuffer();
  },
  flushBuffer: function() {
    // Make sure to shift out old data
    this.adaChart.data.datasets.forEach(
      dataset => {
        if (dataset.data.length > this.maxBufferSize) {
          dataset.data.shift()
        }
      }
    )
    this.update();
  },
  dataset: function(dataSetIndex) {
    return this.adaChart.data.datasets[dataSetIndex];
  },
  setBufferSize: function(size) {
    this.maxBufferSize = size;
  }
}
