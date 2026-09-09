// public/js/charts.js

class ChartManager {
  constructor() {
    this.charts = {};
    this.colors = {
      primary: '#2196F3',
      secondary: '#1976D2',
      success: '#4CAF50',
      danger: '#F44336',
      warning: '#FFA500',
      info: '#2196F3',
      light: '#F5F5F5',
      dark: '#333'
    };
  }

  /**
   * Initialize all charts
   */
  async initializeCharts() {
    try {
      await this.initStatusChart();
      await this.initDailyReportsChart();
      await this.initWeeklyReportsChart();
      await this.initMonthlyReportsChart();
      await this.initDepartmentChart();
      await this.initEmployeeActivityChart();
      await this.initPriorityDistributionChart();
      await this.initHoursWorkedChart();
    } catch (error) {
      console.error('Charts initialization error:', error);
    }
  }

  /**
   * 1. Report Status Distribution (Doughnut Chart)
   */
  async initStatusChart() {
    try {
      const reports = await reportManager.getAllReports();
      
      const statusData = {
        pending: reports.filter(r => r.status === 'pending').length,
        approved: reports.filter(r => r.status === 'approved').length,
        rejected: reports.filter(r => r.status === 'rejected').length,
        reviewed: reports.filter(r => r.status === 'reviewed').length
      };

      const canvas = document.getElementById('statusChart');
      if (!canvas) return;

      // Destroy existing chart if it exists
      if (this.charts.statusChart) {
        this.charts.statusChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      this.charts.statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Pending Review', 'Approved', 'Rejected', 'Reviewed'],
          datasets: [{
            data: [
              statusData.pending,
              statusData.approved,
              statusData.rejected,
              statusData.reviewed
            ],
            backgroundColor: [
              this.colors.warning,
              this.colors.success,
              this.colors.danger,
              this.colors.info
            ],
            borderColor: '#fff',
            borderWidth: 2,
            hoverOffset: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font: { size: 12, family: 'inherit' },
                padding: 15,
                boxWidth: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              titleFont: { size: 12 },
              bodyFont: { size: 11 },
              borderColor: '#fff',
              borderWidth: 1,
              displayColors: true,
              callbacks: {
                label: (context) => {
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((context.parsed / total) * 100).toFixed(1);
                  return `${context.label}: ${context.parsed} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Status chart error:', error);
    }
  }

  /**
   * 2. Daily Reports (Last 7 Days) - Bar Chart
   */
  async initDailyReportsChart() {
    try {
      const reports = await reportManager.getAllReports();
      const last7Days = this.getLast7Days();
      
      const dailyData = last7Days.map(date => 
        reports.filter(r => r.reportDate === date).length
      );

      const canvas = document.getElementById('dailyChart');
      if (!canvas) return;

      if (this.charts.dailyChart) {
        this.charts.dailyChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      this.charts.dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: last7Days.map(date => this.formatChartDate(date)),
          datasets: [{
            label: 'Reports Submitted',
            data: dailyData,
            backgroundColor: this.colors.primary,
            borderColor: this.colors.secondary,
            borderWidth: 2,
            borderRadius: 5,
            hoverBackgroundColor: this.colors.secondary,
            barPercentage: 0.7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          indexAxis: 'x',
          plugins: {
            legend: {
              display: true,
              labels: {
                font: { size: 12, family: 'inherit' },
                padding: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              callbacks: {
                label: (context) => `Reports: ${context.parsed.y}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                font: { size: 11 }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: { size: 11 }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Daily chart error:', error);
    }
  }

  /**
   * 3. Weekly Reports (Last 4 Weeks) - Line Chart
   */
  async initWeeklyReportsChart() {
    try {
      const reports = await reportManager.getAllReports();
      const weeks = this.getLast4Weeks();
      
      const weeklyData = weeks.map(({ start, end }) => 
        reports.filter(r => {
          const date = new Date(r.reportDate);
          return date >= start && date <= end;
        }).length
      );

      const canvas = document.getElementById('weeklyChart');
      if (!canvas) return;

      if (this.charts.weeklyChart) {
        this.charts.weeklyChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      this.charts.weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: weeks.map((_, i) => `Week ${i + 1}`),
          datasets: [{
            label: 'Weekly Reports',
            data: weeklyData,
            borderColor: this.colors.primary,
            backgroundColor: `rgba(33, 150, 243, 0.1)`,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: this.colors.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            hoverBackgroundColor: this.colors.secondary
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              labels: {
                font: { size: 12, family: 'inherit' },
                padding: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              callbacks: {
                label: (context) => `Reports: ${context.parsed.y}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                font: { size: 11 }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: { size: 11 }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Weekly chart error:', error);
    }
  }

  /**
   * 4. Monthly Reports - Bar Chart
   */
  async initMonthlyReportsChart() {
    try {
      const reports = await reportManager.getAllReports();
      const months = this.getLast6Months();
      
      const monthlyData = months.map(({ start, end }) => 
        reports.filter(r => {
          const date = new Date(r.reportDate);
          return date >= start && date <= end;
        }).length
      );

      const canvas = document.getElementById('monthlyChart');
      if (!canvas) return;

      if (this.charts.monthlyChart) {
        this.charts.monthlyChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      this.charts.monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: months.map(m => this.formatMonth(m.start)),
          datasets: [{
            label: 'Monthly Reports',
            data: monthlyData,
            backgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#FFCE56',
              '#4BC0C0',
              '#9966FF',
              '#FF9F40'
            ],
            borderWidth: 1,
            borderColor: '#fff',
            hoverBackgroundColor: this.colors.secondary,
            borderRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              callbacks: {
                label: (context) => `Reports: ${context.parsed.y}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                font: { size: 11 }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: { size: 11 }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Monthly chart error:', error);
    }
  }

  /**
   * 5. Department Performance - Horizontal Bar Chart
   */
  async initDepartmentChart() {
    try {
      const reports = await reportManager.getAllReports();
      const employees = await employeeManager.getAllEmployees();
      
      // Group reports by department
      const departments = {};
      employees.forEach(emp => {
        if (!departments[emp.department]) {
          departments[emp.department] = {
            total: 0,
            approved: 0,
            submitted: 0
          };
        }
      });

      reports.forEach(report => {
        if (departments[report.department]) {
          departments[report.department].total++;
          if (report.status === 'approved') {
            departments[report.department].approved++;
          }
        }
      });

      const deptNames = Object.keys(departments);
      const totalData = deptNames.map(dept => departments[dept].total);
      const approvedData = deptNames.map(dept => departments[dept].approved);

      const canvas = document.getElementById('departmentChart');
      if (!canvas) return;

      if (this.charts.departmentChart) {
        this.charts.departmentChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      this.charts.departmentChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: deptNames,
          datasets: [
            {
              label: 'Total Reports',
              data: totalData,
              backgroundColor: this.colors.primary,
              borderRadius: 5
            },
            {
              label: 'Approved Reports',
              data: approvedData,
              backgroundColor: this.colors.success,
              borderRadius: 5
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              labels: {
                font: { size: 12, family: 'inherit' },
                padding: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12
            }
          },
          scales: {
            x: {
              stacked: false,
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false
              }
            },
            y: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Department chart error:', error);
    }
  }

  /**
   * 6. Employee Activity - Radar Chart
   */
  async initEmployeeActivityChart() {
    try {
      const employees = await employeeManager.getAllEmployees();
      
      const employeeStats = await Promise.all(
        employees.slice(0, 8).map(async (emp) => ({
          name: emp.fullName,
          stats: await employeeManager.getEmployeeStats(emp.id)
        }))
      );

      const labels = employeeStats.map(e => e.name);
      const datasetData = employeeStats.map(e => e.stats?.totalReports || 0);

      const canvas = document.getElementById('employeeActivityChart');
      if (!canvas) return;

      if (this.charts.employeeActivityChart) {
        this.charts.employeeActivityChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      this.charts.employeeActivityChart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Reports Submitted',
            data: datasetData,
            borderColor: this.colors.primary,
            backgroundColor: `rgba(33, 150, 243, 0.2)`,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: this.colors.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              labels: {
                font: { size: 12, family: 'inherit' },
                padding: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12
            }
          },
          scales: {
            r: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                font: { size: 10 }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Employee activity chart error:', error);
    }
  }

  /**
   * 7. Priority Distribution - Pie Chart
   */
  async initPriorityDistributionChart() {
    try {
      const reports = await reportManager.getAllReports();
      
      const priorityData = {
        low: reports.filter(r => r.priorityLevel === 'low').length,
        medium: reports.filter(r => r.priorityLevel === 'medium').length,
        high: reports.filter(r => r.priorityLevel === 'high').length,
        critical: reports.filter(r => r.priorityLevel === 'critical').length
      };

      const canvas = document.getElementById('priorityChart');
      if (!canvas) return;

      if (this.charts.priorityChart) {
        this.charts.priorityChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      this.charts.priorityChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Low', 'Medium', 'High', 'Critical'],
          datasets: [{
            data: [
              priorityData.low,
              priorityData.medium,
              priorityData.high,
              priorityData.critical
            ],
            backgroundColor: [
              '#4CAF50',
              '#FFA500',
              '#FF9800',
              '#F44336'
            ],
            borderColor: '#fff',
            borderWidth: 2,
            hoverOffset: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font: { size: 12, family: 'inherit' },
                padding: 15,
                boxWidth: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              callbacks: {
                label: (context) => {
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((context.parsed / total) * 100).toFixed(1);
                  return `${context.label}: ${context.parsed} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Priority chart error:', error);
    }
  }

  /**
   * 8. Average Hours Worked by Department - Mixed Chart
   */
  async initHoursWorkedChart() {
    try {
      const reports = await reportManager.getAllReports();
      const employees = await employeeManager.getAllEmployees();
      
      // Group by department
      const departments = {};
      employees.forEach(emp => {
        if (!departments[emp.department]) {
          departments[emp.department] = [];
        }
      });

      reports.forEach(report => {
        if (departments[report.department]) {
          departments[report.department].push(report.hoursWorked || 0);
        }
      });

      const deptNames = Object.keys(departments);
      const avgHours = deptNames.map(dept => {
        const hours = departments[dept];
        return hours.length > 0 
          ? (hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(2)
          : 0;
      });

      const canvas = document.getElementById('hoursChart');
      if (!canvas) return;

      if (this.charts.hoursChart) {
        this.charts.hoursChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      this.charts.hoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: deptNames,
          datasets: [{
            label: 'Average Hours Worked',
            data: avgHours,
            backgroundColor: this.colors.info,
            borderColor: this.colors.secondary,
            borderWidth: 2,
            borderRadius: 5,
            hoverBackgroundColor: this.colors.secondary
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              labels: {
                font: { size: 12, family: 'inherit' },
                padding: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              callbacks: {
                label: (context) => `Avg Hours: ${context.parsed.y}h`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => `${value}h`,
                font: { size: 11 }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: { size: 11 }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Hours chart error:', error);
    }
  }

  /**
   * Helper: Get last 7 days
   */
  getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  }

  /**
   * Helper: Get last 4 weeks
   */
  getLast4Weeks() {
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - (i * 7));
      
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);
      
      weeks.push({ start: startDate, end: endDate });
    }
    return weeks;
  }

  /**
   * Helper: Get last 6 months
   */
  getLast6Months() {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() - i);
      endDate.setDate(0); // Last day of month
      
      const startDate = new Date(endDate);
      startDate.setDate(1); // First day of month
      
      months.push({ start: startDate, end: endDate });
    }
    return months;
  }

  /**
   * Helper: Format date for chart display
   */
  formatChartDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  /**
   * Helper: Format month
   */
  formatMonth(date) {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }

  /**
   * Refresh all charts with real-time data
   */
  async refreshAllCharts() {
    await this.initializeCharts();
  }

  /**
   * Setup real-time listeners for charts
   */
  setupRealtimeListeners() {
    // Listen for report changes
    db.collection('reports').onSnapshot(() => {
      this.refreshAllCharts();
    });
  }

  /**
   * Export chart as image
   */
  async exportChartAsImage(chartId, fileName = 'chart.png') {
    const chart = this.charts[chartId];
    if (!chart) {
      showNotification('Chart not found', 'error');
      return;
    }

    const url = chart.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();

    showNotification('Chart exported successfully!', 'success');
  }

  /**
   * Print charts
   */
  printCharts() {
    const printWindow = window.open('', '', 'width=900,height=600');
    const chartsHTML = `
      <html>
        <head>
          <title>Report Charts</title>
          <style>
            body { font-family: Arial, sans-serif; }
            .chart-container { page-break-inside: avoid; margin: 20px 0; }
            canvas { max-width: 100%; }
          </style>
        </head>
        <body>
          ${Array.from(document.querySelectorAll('.chart-container'))
            .map(el => `<div class="chart-container">${el.innerHTML}</div>`)
            .join('')}
        </body>
      </html>
    `;
    printWindow.document.write(chartsHTML);
    printWindow.document.close();
    printWindow.print();
  }
}

// Initialize chart manager
const chartManager = new ChartManager();
