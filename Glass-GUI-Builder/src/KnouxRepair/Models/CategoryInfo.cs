using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace KnouxRepair.Models
{
    public class CategoryInfo
    {
        [JsonPropertyName("Category")]
        public string Category { get; set; }

        [JsonPropertyName("Folder")]
        public string Folder { get; set; }

        [JsonPropertyName("Tools")]
        public List<CategoryTool> Tools { get; set; } = new List<CategoryTool>();
    }

    public class CategoryTool
    {
        [JsonPropertyName("Id")]
        public string Id { get; set; }

        [JsonPropertyName("Name")]
        public string Name { get; set; }

        [JsonPropertyName("File")]
        public string File { get; set; }

        [JsonPropertyName("Risk")]
        public string Risk { get; set; }

        [JsonPropertyName("RequiresAdmin")]
        public bool RequiresAdmin { get; set; }
    }
}
