namespace KnouxRepair.Models
{
    public class TestResultEntry
    {
        public string Name { get; set; }
        public string Status { get; set; }
        public string Detail { get; set; }

        public bool IsPass => Status == "PASS";
        public bool IsError => Status == "ERROR";
    }
}