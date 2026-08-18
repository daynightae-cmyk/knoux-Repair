using System;
using System.Collections.ObjectModel;
using System.Linq;
using KnouxRepair.Models;
using KnouxRepair.Mvvm;

namespace KnouxRepair.ViewModels
{
    public class ReportsViewModel : ViewModelBase
    {
        public ReportsViewModel()
        {
            Services.ReportsService.RefreshReports();
            Services.ReportsService.NewReportDetected += OnNewReport;
        }

        public ObservableCollection<ReportEntry> Reports => Services.ReportsService.Reports;

        public int TotalReports => Reports.Count;

        private void OnNewReport(ReportEntry entry)
        {
            OnPropertyChanged(nameof(TotalReports));
        }
    }
}
