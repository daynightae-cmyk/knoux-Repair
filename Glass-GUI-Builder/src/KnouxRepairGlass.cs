// KNOUX Repair Glass GUI
// Native Windows Forms launcher for KNOUX Repair.
// No Node.js, Electron, npm, web server, cloud service, or internet dependency.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace KnouxRepairGlass
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    public sealed class ToolItem
    {
        public string ToolId { get; set; }
        public string Category { get; set; }
        public string ScriptPath { get; set; }
        public string EnglishName { get; set; }
        public string ArabicName { get; set; }
        public string Purpose { get; set; }
        public string RiskLevel { get; set; }
        public bool RequiresAdmin { get; set; }
        public bool RequiresRestart { get; set; }
        public string OfflineCapability { get; set; }
        public string BackupMethod { get; set; }
        public string RollbackMethod { get; set; }
        public bool AnalyzeOnlySupported { get; set; }
        public bool WhatIfSupported { get; set; }
        public string TestResult { get; set; }
    }

    internal static class NativeMethods
    {
        public const int WM_NCLBUTTONDOWN = 0xA1;
        public const int HT_CAPTION = 0x2;
        public const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        public static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);

        [DllImport("gdi32.dll")]
        public static extern IntPtr CreateRoundRectRgn(int left, int top, int right, int bottom, int width, int height);

        [DllImport("dwmapi.dll")]
        public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        [DllImport("user32.dll")]
        private static extern int SetWindowCompositionAttribute(IntPtr hwnd, ref WindowCompositionAttributeData data);

        public enum AccentState
        {
            Disabled = 0,
            EnableGradient = 1,
            EnableTransparentGradient = 2,
            EnableBlurBehind = 3,
            EnableAcrylicBlurBehind = 4
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct AccentPolicy
        {
            public AccentState AccentState;
            public int AccentFlags;
            public int GradientColor;
            public int AnimationId;
        }

        public enum WindowCompositionAttribute
        {
            WcaAccentPolicy = 19
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct WindowCompositionAttributeData
        {
            public WindowCompositionAttribute Attribute;
            public IntPtr Data;
            public int SizeOfData;
        }

        public static void EnableAcrylic(IntPtr handle)
        {
            try
            {
                AccentPolicy policy = new AccentPolicy();
                policy.AccentState = AccentState.EnableAcrylicBlurBehind;
                policy.AccentFlags = 2;
                policy.GradientColor = unchecked((int)0xD01C140A);

                int size = Marshal.SizeOf(policy);
                IntPtr pointer = Marshal.AllocHGlobal(size);
                try
                {
                    Marshal.StructureToPtr(policy, pointer, false);
                    WindowCompositionAttributeData data = new WindowCompositionAttributeData();
                    data.Attribute = WindowCompositionAttribute.WcaAccentPolicy;
                    data.SizeOfData = size;
                    data.Data = pointer;
                    SetWindowCompositionAttribute(handle, ref data);
                }
                finally
                {
                    Marshal.FreeHGlobal(pointer);
                }

                int dark = 1;
                DwmSetWindowAttribute(handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, sizeof(int));
            }
            catch
            {
                // Acrylic is cosmetic. The application remains functional without it.
            }
        }
    }

    public class GlassPanel : Panel
    {
        public int Radius { get; set; }
        public Color BorderColor { get; set; }
        public Color StartColor { get; set; }
        public Color EndColor { get; set; }

        public GlassPanel()
        {
            Radius = 18;
            BorderColor = Color.FromArgb(78, 122, 176, 220);
            StartColor = Color.FromArgb(155, 18, 38, 62);
            EndColor = Color.FromArgb(120, 8, 22, 40);
            SetStyle(ControlStyles.SupportsTransparentBackColor |
                     ControlStyles.AllPaintingInWmPaint |
                     ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer |
                     ControlStyles.ResizeRedraw, true);
            BackColor = Color.Transparent;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle rect = new Rectangle(0, 0, Math.Max(1, Width - 1), Math.Max(1, Height - 1));
            using (GraphicsPath path = Rounded(rect, Radius))
            using (LinearGradientBrush brush = new LinearGradientBrush(rect, StartColor, EndColor, 110f))
            using (Pen pen = new Pen(BorderColor, 1f))
            {
                e.Graphics.FillPath(brush, path);
                e.Graphics.DrawPath(pen, path);
            }
            base.OnPaint(e);
        }

        private static GraphicsPath Rounded(Rectangle rect, int radius)
        {
            int diameter = radius * 2;
            GraphicsPath path = new GraphicsPath();
            path.AddArc(rect.Left, rect.Top, diameter, diameter, 180, 90);
            path.AddArc(rect.Right - diameter, rect.Top, diameter, diameter, 270, 90);
            path.AddArc(rect.Right - diameter, rect.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(rect.Left, rect.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    public class GlassButton : Button
    {
        public int Radius { get; set; }
        public Color FillColor { get; set; }
        public Color HoverColor { get; set; }
        public Color BorderGlow { get; set; }
        private bool hovering;

        public GlassButton()
        {
            Radius = 13;
            FillColor = Color.FromArgb(150, 20, 54, 82);
            HoverColor = Color.FromArgb(205, 30, 88, 130);
            BorderGlow = Color.FromArgb(110, 88, 200, 255);
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            ForeColor = Color.White;
            Cursor = Cursors.Hand;
            Font = new Font("Segoe UI Semibold", 9.5f);
            Height = 38;
            MouseEnter += delegate { hovering = true; Invalidate(); };
            MouseLeave += delegate { hovering = false; Invalidate(); };
        }

        protected override void OnPaint(PaintEventArgs pevent)
        {
            pevent.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            using (GraphicsPath path = Rounded(rect, Radius))
            using (SolidBrush brush = new SolidBrush(hovering ? HoverColor : FillColor))
            using (Pen pen = new Pen(BorderGlow, 1f))
            {
                pevent.Graphics.FillPath(brush, path);
                pevent.Graphics.DrawPath(pen, path);
                TextRenderer.DrawText(
                    pevent.Graphics,
                    Text,
                    Font,
                    rect,
                    ForeColor,
                    TextFormatFlags.HorizontalCenter |
                    TextFormatFlags.VerticalCenter |
                    TextFormatFlags.EndEllipsis);
            }
        }

        private static GraphicsPath Rounded(Rectangle rect, int radius)
        {
            int diameter = radius * 2;
            GraphicsPath path = new GraphicsPath();
            path.AddArc(rect.Left, rect.Top, diameter, diameter, 180, 90);
            path.AddArc(rect.Right - diameter, rect.Top, diameter, diameter, 270, 90);
            path.AddArc(rect.Right - diameter, rect.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(rect.Left, rect.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    public sealed class MainForm : Form
    {
        private readonly Color Navy = Color.FromArgb(8, 18, 34);
        private readonly Color Navy2 = Color.FromArgb(11, 28, 48);
        private readonly Color Cyan = Color.FromArgb(77, 240, 255);
        private readonly Color Sky = Color.FromArgb(92, 184, 255);
        private readonly Color Gold = Color.FromArgb(212, 175, 55);
        private readonly Color Muted = Color.FromArgb(164, 182, 204);

        private string projectRoot;
        private List<ToolItem> allTools;
        private ToolItem selectedTool;
        private string selectedCategory;
        private bool arabic = true;
        private bool operationRunning;
        private Process currentProcess;

        private Panel sidebar;
        private Panel topbar;
        private FlowLayoutPanel toolsFlow;
        private TextBox searchBox;
        private RichTextBox logBox;
        private TextBox inputBox;
        private GlassButton sendInputButton;
        private GlassButton cancelButton;
        private GlassButton runButton;
        private GlassButton analyzeButton;
        private Label detailTitle;
        private Label detailSubTitle;
        private Label detailPurpose;
        private Label detailMeta;
        private Label statusLabel;
        private Label headerTitle;
        private Label headerSubTitle;
        private Label toolCountValue;
        private Label adminCountValue;
        private Label safeCountValue;
        private Label reportsCountValue;
        private CheckBox analyzeToggle;
        private ProgressBar progress;
        private GlassPanel detailsPanel;
        private Panel contentHost;

        public MainForm()
        {
            allTools = new List<ToolItem>();
            selectedCategory = String.Empty;

            Text = "Knoux Repair";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(1180, 720);
            Size = new Size(1480, 900);
            BackColor = Navy;
            ForeColor = Color.White;
            Font = new Font("Segoe UI", 9.5f);
            DoubleBuffered = true;
            KeyPreview = true;

            Load += MainForm_Load;
            Resize += MainForm_Resize;
            FormClosing += MainForm_FormClosing;
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            NativeMethods.EnableAcrylic(Handle);
        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            ApplyRoundedRegion();
            projectRoot = FindProjectRoot();

            if (String.IsNullOrEmpty(projectRoot))
            {
                MessageBox.Show(
                    "تعذر العثور على مجلد مشروع KNOUX Repair.\r\nاختر المجلد الذي يحتوي على Docs و Config.",
                    "KNOUX Repair",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);

                using (FolderBrowserDialog dialog = new FolderBrowserDialog())
                {
                    dialog.Description = "Select the KNOUX Repair project folder";
                    if (dialog.ShowDialog() == DialogResult.OK)
                    {
                        projectRoot = dialog.SelectedPath;
                    }
                }
            }

            if (String.IsNullOrEmpty(projectRoot))
            {
                Close();
                return;
            }

            LoadTools();
            BuildInterface();
            RefreshDashboard();
            RefreshTools();
            AppendLog("KNOUX Repair Glass GUI started.", Color.LightGreen);
            AppendLog("Project root: " + projectRoot, Muted);
        }

        private void MainForm_Resize(object sender, EventArgs e)
        {
            ApplyRoundedRegion();
            if (toolsFlow != null)
            {
                ReflowToolCards();
            }
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (operationRunning && currentProcess != null && !currentProcess.HasExited)
            {
                DialogResult answer = MessageBox.Show(
                    arabic ? "هناك أداة تعمل الآن. هل تريد إيقافها والخروج؟" :
                             "A tool is currently running. Stop it and exit?",
                    "KNOUX Repair",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);

                if (answer != DialogResult.Yes)
                {
                    e.Cancel = true;
                    return;
                }

                try { currentProcess.Kill(); } catch { }
            }
        }

        private void ApplyRoundedRegion()
        {
            if (WindowState == FormWindowState.Maximized)
            {
                Region = null;
                return;
            }

            IntPtr region = NativeMethods.CreateRoundRectRgn(0, 0, Width + 1, Height + 1, 24, 24);
            Region = Region.FromHrgn(region);
        }

        private string FindProjectRoot()
        {
            string current = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');

            for (int i = 0; i < 6; i++)
            {
                if (File.Exists(Path.Combine(current, "Docs", "TOOLS-MANIFEST.json")) &&
                    Directory.Exists(Path.Combine(current, "Config")) &&
                    Directory.Exists(Path.Combine(current, "Core")))
                {
                    return current;
                }

                DirectoryInfo parent = Directory.GetParent(current);
                if (parent == null) break;
                current = parent.FullName;
            }

            return null;
        }

        private void LoadTools()
        {
            try
            {
                string manifestPath = Path.Combine(projectRoot, "Docs", "TOOLS-MANIFEST.json");
                string json = File.ReadAllText(manifestPath, new UTF8Encoding(false));
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                serializer.MaxJsonLength = Int32.MaxValue;
                List<ToolItem> parsed = serializer.Deserialize<List<ToolItem>>(json);
                allTools = parsed ?? new List<ToolItem>();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Failed to load TOOLS-MANIFEST.json\r\n\r\n" + ex.Message,
                    "KNOUX Repair",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                allTools = new List<ToolItem>();
            }
        }

        private void BuildInterface()
        {
            Controls.Clear();

            sidebar = new Panel();
            sidebar.Dock = DockStyle.Left;
            sidebar.Width = 255;
            sidebar.Padding = new Padding(16, 18, 16, 16);
            sidebar.BackColor = Color.FromArgb(205, 5, 16, 30);
            Controls.Add(sidebar);

            BuildSidebar();

            topbar = new Panel();
            topbar.Dock = DockStyle.Top;
            topbar.Height = 70;
            topbar.BackColor = Color.FromArgb(150, 9, 23, 40);
            topbar.MouseDown += DragForm;
            Controls.Add(topbar);
            BuildTopbar();

            contentHost = new Panel();
            contentHost.Dock = DockStyle.Fill;
            contentHost.Padding = new Padding(18);
            contentHost.BackColor = Navy;
            Controls.Add(contentHost);

            SplitContainer split = new SplitContainer();
            split.Dock = DockStyle.Fill;
            split.Orientation = Orientation.Vertical;
            split.SplitterWidth = 8;
            split.SplitterDistance = Math.Max(700, Width - 610);
            split.BackColor = Navy;
            split.Panel1.Padding = new Padding(0, 0, 8, 0);
            split.Panel2.Padding = new Padding(8, 0, 0, 0);
            contentHost.Controls.Add(split);

            BuildToolArea(split.Panel1);
            BuildExecutionArea(split.Panel2);
        }

        private void BuildSidebar()
        {
            sidebar.Controls.Clear();

            PictureBox logo = new PictureBox();
            logo.Size = new Size(68, 68);
            logo.Location = new Point(16, 10);
            logo.SizeMode = PictureBoxSizeMode.Zoom;
            try
            {
                Icon icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (icon != null) logo.Image = icon.ToBitmap();
            }
            catch { }
            sidebar.Controls.Add(logo);

            Label brand = new Label();
            brand.Text = "KNOUX";
            brand.Font = new Font("Segoe UI Black", 18f);
            brand.ForeColor = Color.White;
            brand.AutoSize = true;
            brand.Location = new Point(92, 16);
            sidebar.Controls.Add(brand);

            Label product = new Label();
            product.Text = "REPAIR";
            product.Font = new Font("Segoe UI Semibold", 10f);
            product.ForeColor = Cyan;
            product.AutoSize = true;
            product.Location = new Point(94, 47);
            sidebar.Controls.Add(product);

            Label version = new Label();
            version.Text = "Glass GUI 1.0.1";
            version.Font = new Font("Segoe UI", 8f);
            version.ForeColor = Muted;
            version.AutoSize = true;
            version.Location = new Point(94, 64);
            sidebar.Controls.Add(version);

            Panel line = new Panel();
            line.BackColor = Color.FromArgb(70, 92, 184, 255);
            line.Height = 1;
            line.Width = sidebar.Width - 32;
            line.Location = new Point(16, 94);
            sidebar.Controls.Add(line);

            FlowLayoutPanel nav = new FlowLayoutPanel();
            nav.FlowDirection = FlowDirection.TopDown;
            nav.WrapContents = false;
            nav.AutoScroll = true;
            nav.Location = new Point(8, 110);
            nav.Size = new Size(sidebar.Width - 16, sidebar.Height - 210);
            nav.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            nav.BackColor = Color.FromArgb(205, 5, 16, 30);
            sidebar.Controls.Add(nav);

            AddNavButton(nav, "ALL", arabic ? "كل الأدوات" : "All Tools", "");
            AddNavButton(nav, "01", arabic ? "صيانة النظام" : "System Maintenance", "01-System-Maintenance");
            AddNavButton(nav, "02", arabic ? "تنظيف النظام" : "System Cleanup", "02-System-Cleanup");
            AddNavButton(nav, "03", arabic ? "الشبكة والإنترنت" : "Network & Internet", "03-Network-Internet");
            AddNavButton(nav, "04", arabic ? "البرامج والتطبيقات" : "Programs & Applications", "04-Programs-Applications");
            AddNavButton(nav, "05", arabic ? "الملفات المكررة" : "Duplicate Files", "05-Duplicate-Files");
            AddNavButton(nav, "06", arabic ? "مساحة القرص" : "Disk Space", "06-Disk-Space");
            AddNavButton(nav, "07", arabic ? "الخدمات والعمليات" : "Services & Processes", "07-Services-Processes");
            AddNavButton(nav, "08", arabic ? "الأداء" : "Performance", "08-Performance");
            AddNavButton(nav, "09", arabic ? "الأمان" : "Security", "09-Security");
            AddNavButton(nav, "10", arabic ? "التشخيص والتقارير" : "Diagnostics & Reports", "10-Diagnostics-Reports");

            GlassButton language = new GlassButton();
            language.Text = arabic ? "English Interface" : "الواجهة العربية";
            language.Width = sidebar.Width - 32;
            language.Location = new Point(16, sidebar.Height - 86);
            language.Anchor = AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            language.FillColor = Color.FromArgb(130, 31, 46, 74);
            language.Click += delegate
            {
                arabic = !arabic;
                BuildInterface();
                RefreshDashboard();
                RefreshTools();
            };
            sidebar.Controls.Add(language);

            Label admin = new Label();
            admin.Text = IsAdministrator() ? "● ADMINISTRATOR" : "● STANDARD USER";
            admin.ForeColor = IsAdministrator() ? Color.LightGreen : Color.Orange;
            admin.Font = new Font("Consolas", 8.5f, FontStyle.Bold);
            admin.AutoSize = true;
            admin.Location = new Point(19, sidebar.Height - 36);
            admin.Anchor = AnchorStyles.Bottom | AnchorStyles.Left;
            sidebar.Controls.Add(admin);
        }

        private void AddNavButton(FlowLayoutPanel nav, string code, string title, string category)
        {
            GlassButton button = new GlassButton();
            button.Width = nav.ClientSize.Width - 22;
            button.Height = 43;
            button.Margin = new Padding(6, 3, 6, 3);
            button.TextAlign = ContentAlignment.MiddleLeft;
            button.Text = "  " + code + "   " + title;
            button.Tag = category;
            button.FillColor = category == selectedCategory
                ? Color.FromArgb(220, 25, 91, 130)
                : Color.FromArgb(80, 16, 40, 65);
            button.Click += delegate(object sender, EventArgs e)
            {
                Button clicked = sender as Button;
                selectedCategory = clicked == null ? "" : Convert.ToString(clicked.Tag);
                BuildSidebar();
                RefreshTools();
            };
            nav.Controls.Add(button);
        }

        private void BuildTopbar()
        {
            headerTitle = new Label();
            headerTitle.Text = arabic ? "لوحة إصلاح وصيانة ويندوز" : "Windows Repair & Maintenance Dashboard";
            headerTitle.Font = new Font("Segoe UI Semibold", 15f);
            headerTitle.ForeColor = Color.White;
            headerTitle.AutoSize = true;
            headerTitle.Location = new Point(24, 12);
            headerTitle.MouseDown += DragForm;
            topbar.Controls.Add(headerTitle);

            headerSubTitle = new Label();
            headerSubTitle.Text = arabic
                ? "واجهة محلية فاخرة لتشغيل 100 أداة بأمان"
                : "Premium local interface for 100 controlled tools";
            headerSubTitle.Font = new Font("Segoe UI", 9f);
            headerSubTitle.ForeColor = Muted;
            headerSubTitle.AutoSize = true;
            headerSubTitle.Location = new Point(26, 40);
            headerSubTitle.MouseDown += DragForm;
            topbar.Controls.Add(headerSubTitle);

            statusLabel = new Label();
            statusLabel.Text = arabic ? "جاهز" : "Ready";
            statusLabel.ForeColor = Color.LightGreen;
            statusLabel.Font = new Font("Segoe UI Semibold", 9f);
            statusLabel.AutoSize = true;
            statusLabel.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            statusLabel.Location = new Point(topbar.Width - 330, 26);
            topbar.Resize += delegate { statusLabel.Left = topbar.Width - 330; };
            topbar.Controls.Add(statusLabel);

            GlassButton minimize = WindowButton("—");
            minimize.Location = new Point(topbar.Width - 150, 14);
            minimize.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            minimize.Click += delegate { WindowState = FormWindowState.Minimized; };
            topbar.Controls.Add(minimize);

            GlassButton maximize = WindowButton("□");
            maximize.Location = new Point(topbar.Width - 100, 14);
            maximize.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            maximize.Click += delegate
            {
                WindowState = WindowState == FormWindowState.Maximized
                    ? FormWindowState.Normal
                    : FormWindowState.Maximized;
            };
            topbar.Controls.Add(maximize);

            GlassButton close = WindowButton("×");
            close.Location = new Point(topbar.Width - 50, 14);
            close.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            close.HoverColor = Color.FromArgb(230, 180, 40, 55);
            close.Click += delegate { Close(); };
            topbar.Controls.Add(close);
        }

        private GlassButton WindowButton(string text)
        {
            GlassButton button = new GlassButton();
            button.Text = text;
            button.Width = 38;
            button.Height = 36;
            button.Radius = 10;
            button.FillColor = Color.FromArgb(80, 30, 50, 70);
            button.BorderGlow = Color.FromArgb(60, 130, 180, 220);
            return button;
        }

        private void BuildToolArea(Control host)
        {
            FlowLayoutPanel metrics = new FlowLayoutPanel();
            metrics.Dock = DockStyle.Top;
            metrics.Height = 116;
            metrics.WrapContents = false;
            metrics.FlowDirection = FlowDirection.LeftToRight;
            metrics.Padding = new Padding(0, 0, 0, 10);
            metrics.BackColor = Navy;
            host.Controls.Add(metrics);

            toolCountValue = AddMetric(metrics, arabic ? "إجمالي الأدوات" : "Total Tools", Cyan);
            safeCountValue = AddMetric(metrics, arabic ? "أدوات آمنة" : "Safe Tools", Color.LightGreen);
            adminCountValue = AddMetric(metrics, arabic ? "تتطلب مسؤول" : "Admin Tools", Gold);
            reportsCountValue = AddMetric(metrics, arabic ? "التقارير" : "Reports", Sky);

            GlassPanel searchPanel = new GlassPanel();
            searchPanel.Dock = DockStyle.Top;
            searchPanel.Height = 64;
            searchPanel.Padding = new Padding(14, 11, 14, 10);
            host.Controls.Add(searchPanel);
            searchPanel.BringToFront();

            searchBox = new TextBox();
            searchBox.BorderStyle = BorderStyle.None;
            searchBox.BackColor = Color.FromArgb(18, 34, 54);
            searchBox.ForeColor = Color.White;
            searchBox.Font = new Font("Segoe UI", 11f);
            searchBox.Dock = DockStyle.Fill;
            searchBox.Margin = new Padding(5);
            searchBox.TextChanged += delegate { RefreshTools(); };
            searchPanel.Controls.Add(searchBox);

            analyzeToggle = new CheckBox();
            analyzeToggle.Appearance = Appearance.Button;
            analyzeToggle.AutoSize = false;
            analyzeToggle.Width = 175;
            analyzeToggle.Dock = DockStyle.Right;
            analyzeToggle.FlatStyle = FlatStyle.Flat;
            analyzeToggle.FlatAppearance.BorderSize = 0;
            analyzeToggle.BackColor = Color.FromArgb(30, 68, 96);
            analyzeToggle.ForeColor = Color.White;
            analyzeToggle.TextAlign = ContentAlignment.MiddleCenter;
            analyzeToggle.Font = new Font("Segoe UI Semibold", 9f);
            analyzeToggle.Text = arabic ? "Analyze-only: مفعل" : "Analyze-only: ON";
            analyzeToggle.Checked = true;
            analyzeToggle.CheckedChanged += delegate
            {
                analyzeToggle.Text = analyzeToggle.Checked
                    ? (arabic ? "Analyze-only: مفعل" : "Analyze-only: ON")
                    : (arabic ? "Analyze-only: متوقف" : "Analyze-only: OFF");
                analyzeToggle.BackColor = analyzeToggle.Checked
                    ? Color.FromArgb(30, 102, 110)
                    : Color.FromArgb(115, 62, 47);
            };
            searchPanel.Controls.Add(analyzeToggle);

            toolsFlow = new FlowLayoutPanel();
            toolsFlow.Dock = DockStyle.Fill;
            toolsFlow.AutoScroll = true;
            toolsFlow.WrapContents = true;
            toolsFlow.FlowDirection = FlowDirection.LeftToRight;
            toolsFlow.Padding = new Padding(0, 12, 8, 12);
            toolsFlow.BackColor = Navy;
            host.Controls.Add(toolsFlow);
            toolsFlow.BringToFront();
        }

        private Label AddMetric(FlowLayoutPanel host, string title, Color accent)
        {
            GlassPanel panel = new GlassPanel();
            panel.Width = 205;
            panel.Height = 96;
            panel.Margin = new Padding(0, 0, 12, 0);
            panel.BorderColor = Color.FromArgb(90, accent);
            panel.StartColor = Color.FromArgb(170, 17, 42, 66);
            panel.EndColor = Color.FromArgb(115, 8, 22, 40);

            Label value = new Label();
            value.Text = "0";
            value.Font = new Font("Segoe UI Black", 23f);
            value.ForeColor = accent;
            value.AutoSize = true;
            value.Location = new Point(16, 12);
            panel.Controls.Add(value);

            Label caption = new Label();
            caption.Text = title;
            caption.Font = new Font("Segoe UI", 9f);
            caption.ForeColor = Muted;
            caption.AutoSize = true;
            caption.Location = new Point(18, 61);
            panel.Controls.Add(caption);

            host.Controls.Add(panel);
            return value;
        }

        private void BuildExecutionArea(Control host)
        {
            detailsPanel = new GlassPanel();
            detailsPanel.Dock = DockStyle.Top;
            detailsPanel.Height = 310;
            detailsPanel.Padding = new Padding(18);
            host.Controls.Add(detailsPanel);

            detailTitle = new Label();
            detailTitle.Text = arabic ? "اختر أداة" : "Select a tool";
            detailTitle.Font = new Font("Segoe UI Semibold", 16f);
            detailTitle.ForeColor = Color.White;
            detailTitle.AutoSize = false;
            detailTitle.Height = 32;
            detailTitle.Dock = DockStyle.Top;
            detailsPanel.Controls.Add(detailTitle);

            detailSubTitle = new Label();
            detailSubTitle.Text = "";
            detailSubTitle.Font = new Font("Segoe UI", 9f);
            detailSubTitle.ForeColor = Cyan;
            detailSubTitle.AutoSize = false;
            detailSubTitle.Height = 25;
            detailSubTitle.Dock = DockStyle.Top;
            detailsPanel.Controls.Add(detailSubTitle);

            detailPurpose = new Label();
            detailPurpose.Text = arabic ? "اختر أي بطاقة لعرض التفاصيل." : "Select any card to view details.";
            detailPurpose.Font = new Font("Segoe UI", 9.5f);
            detailPurpose.ForeColor = Muted;
            detailPurpose.AutoSize = false;
            detailPurpose.Height = 70;
            detailPurpose.Dock = DockStyle.Top;
            detailsPanel.Controls.Add(detailPurpose);

            detailMeta = new Label();
            detailMeta.Text = "";
            detailMeta.Font = new Font("Consolas", 8.5f);
            detailMeta.ForeColor = Color.FromArgb(190, 210, 230);
            detailMeta.AutoSize = false;
            detailMeta.Height = 55;
            detailMeta.Dock = DockStyle.Top;
            detailsPanel.Controls.Add(detailMeta);

            FlowLayoutPanel actionRow = new FlowLayoutPanel();
            actionRow.Dock = DockStyle.Bottom;
            actionRow.Height = 48;
            actionRow.FlowDirection = FlowDirection.LeftToRight;
            actionRow.WrapContents = false;
            detailsPanel.Controls.Add(actionRow);

            analyzeButton = new GlassButton();
            analyzeButton.Text = arabic ? "تحليل آمن" : "Analyze Safely";
            analyzeButton.Width = 125;
            analyzeButton.FillColor = Color.FromArgb(180, 25, 104, 115);
            analyzeButton.Click += async delegate { await RunSelectedTool(true); };
            actionRow.Controls.Add(analyzeButton);

            runButton = new GlassButton();
            runButton.Text = arabic ? "تشغيل الأداة" : "Run Tool";
            runButton.Width = 125;
            runButton.FillColor = Color.FromArgb(190, 27, 86, 135);
            runButton.Click += async delegate { await RunSelectedTool(false); };
            actionRow.Controls.Add(runButton);

            GlassButton reports = new GlassButton();
            reports.Text = arabic ? "فتح التقارير" : "Open Reports";
            reports.Width = 115;
            reports.FillColor = Color.FromArgb(150, 100, 75, 30);
            reports.Click += delegate { OpenReports(); };
            actionRow.Controls.Add(reports);

            GlassButton tests = new GlassButton();
            tests.Text = arabic ? "تشغيل الاختبارات" : "Run Tests";
            tests.Width = 120;
            tests.FillColor = Color.FromArgb(140, 65, 45, 105);
            tests.Click += async delegate { await RunTestSuite(); };
            actionRow.Controls.Add(tests);

            GlassPanel terminal = new GlassPanel();
            terminal.Dock = DockStyle.Fill;
            terminal.Padding = new Padding(12);
            terminal.Margin = new Padding(0, 12, 0, 0);
            host.Controls.Add(terminal);
            terminal.BringToFront();

            Label terminalTitle = new Label();
            terminalTitle.Text = arabic ? "سجل التنفيذ المباشر" : "Live Execution Console";
            terminalTitle.Dock = DockStyle.Top;
            terminalTitle.Height = 28;
            terminalTitle.ForeColor = Cyan;
            terminalTitle.Font = new Font("Segoe UI Semibold", 10f);
            terminal.Controls.Add(terminalTitle);

            progress = new ProgressBar();
            progress.Dock = DockStyle.Top;
            progress.Height = 5;
            progress.Style = ProgressBarStyle.Marquee;
            progress.MarqueeAnimationSpeed = 0;
            terminal.Controls.Add(progress);

            Panel inputRow = new Panel();
            inputRow.Dock = DockStyle.Bottom;
            inputRow.Height = 45;
            inputRow.Padding = new Padding(0, 6, 0, 0);
            terminal.Controls.Add(inputRow);

            inputBox = new TextBox();
            inputBox.Dock = DockStyle.Fill;
            inputBox.BorderStyle = BorderStyle.FixedSingle;
            inputBox.BackColor = Color.FromArgb(9, 22, 38);
            inputBox.ForeColor = Color.White;
            inputBox.Font = new Font("Consolas", 10f);
            inputBox.Enabled = false;
            inputBox.KeyDown += delegate(object sender, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Enter)
                {
                    SendProcessInput();
                    e.SuppressKeyPress = true;
                }
            };
            inputRow.Controls.Add(inputBox);

            sendInputButton = new GlassButton();
            sendInputButton.Text = arabic ? "إرسال" : "Send";
            sendInputButton.Dock = DockStyle.Right;
            sendInputButton.Width = 82;
            sendInputButton.Enabled = false;
            sendInputButton.Click += delegate { SendProcessInput(); };
            inputRow.Controls.Add(sendInputButton);

            cancelButton = new GlassButton();
            cancelButton.Text = arabic ? "إيقاف" : "Stop";
            cancelButton.Dock = DockStyle.Right;
            cancelButton.Width = 82;
            cancelButton.FillColor = Color.FromArgb(150, 120, 35, 50);
            cancelButton.Enabled = false;
            cancelButton.Click += delegate { CancelCurrentProcess(); };
            inputRow.Controls.Add(cancelButton);

            logBox = new RichTextBox();
            logBox.Dock = DockStyle.Fill;
            logBox.ReadOnly = true;
            logBox.BorderStyle = BorderStyle.None;
            logBox.BackColor = Color.FromArgb(230, 4, 12, 23);
            logBox.ForeColor = Color.Gainsboro;
            logBox.Font = new Font("Consolas", 9.2f);
            logBox.DetectUrls = false;
            terminal.Controls.Add(logBox);
            logBox.BringToFront();
        }

        private void RefreshDashboard()
        {
            if (toolCountValue == null) return;

            toolCountValue.Text = allTools.Count.ToString();
            safeCountValue.Text = allTools.Count(t =>
                String.Equals(t.RiskLevel, "READ_ONLY", StringComparison.OrdinalIgnoreCase) ||
                String.Equals(t.RiskLevel, "SAFE_CLEANUP", StringComparison.OrdinalIgnoreCase)).ToString();
            adminCountValue.Text = allTools.Count(t => t.RequiresAdmin).ToString();

            string reports = Path.Combine(projectRoot, "Reports");
            int reportCount = Directory.Exists(reports)
                ? Directory.GetDirectories(reports).Length
                : 0;
            reportsCountValue.Text = reportCount.ToString();
        }

        private void RefreshTools()
        {
            if (toolsFlow == null) return;

            toolsFlow.SuspendLayout();
            toolsFlow.Controls.Clear();

            string query = searchBox == null ? "" : searchBox.Text.Trim();

            IEnumerable<ToolItem> filtered = allTools;

            if (!String.IsNullOrEmpty(selectedCategory))
            {
                filtered = filtered.Where(t =>
                    !String.IsNullOrEmpty(t.ScriptPath) &&
                    t.ScriptPath.Replace('\\', '/').StartsWith(
                        selectedCategory + "/",
                        StringComparison.OrdinalIgnoreCase));
            }

            if (!String.IsNullOrEmpty(query))
            {
                filtered = filtered.Where(t =>
                    Contains(t.ToolId, query) ||
                    Contains(t.EnglishName, query) ||
                    Contains(t.ArabicName, query) ||
                    Contains(t.Purpose, query) ||
                    Contains(t.RiskLevel, query));
            }

            foreach (ToolItem tool in filtered.OrderBy(t => t.ToolId))
            {
                toolsFlow.Controls.Add(CreateToolCard(tool));
            }

            toolsFlow.ResumeLayout();
            ReflowToolCards();
        }

        private void ReflowToolCards()
        {
            if (toolsFlow == null) return;
            int width = Math.Max(320, (toolsFlow.ClientSize.Width - 42) / 2);
            foreach (Control control in toolsFlow.Controls)
            {
                control.Width = width;
            }
        }

        private Control CreateToolCard(ToolItem tool)
        {
            GlassPanel card = new GlassPanel();
            card.Width = 360;
            card.Height = 158;
            card.Margin = new Padding(0, 0, 12, 12);
            card.Cursor = Cursors.Hand;
            card.Tag = tool;
            card.BorderColor = Color.FromArgb(80, RiskColor(tool.RiskLevel));

            Label id = new Label();
            id.Text = tool.ToolId;
            id.Font = new Font("Consolas", 9f, FontStyle.Bold);
            id.ForeColor = Cyan;
            id.AutoSize = true;
            id.Location = new Point(15, 13);
            card.Controls.Add(id);

            Label risk = new Label();
            risk.Text = tool.RiskLevel ?? "";
            risk.Font = new Font("Segoe UI Semibold", 7.5f);
            risk.ForeColor = RiskColor(tool.RiskLevel);
            risk.AutoSize = true;
            risk.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            risk.Location = new Point(card.Width - 120, 14);
            card.Resize += delegate { risk.Left = card.Width - risk.Width - 16; };
            card.Controls.Add(risk);

            Label title = new Label();
            title.Text = arabic && !String.IsNullOrEmpty(tool.ArabicName)
                ? tool.ArabicName
                : tool.EnglishName;
            title.Font = new Font("Segoe UI Semibold", 11f);
            title.ForeColor = Color.White;
            title.AutoSize = false;
            title.Height = 28;
            title.Location = new Point(15, 38);
            title.Width = card.Width - 30;
            title.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            card.Controls.Add(title);

            Label subtitle = new Label();
            subtitle.Text = arabic ? tool.EnglishName : tool.ArabicName;
            subtitle.Font = new Font("Segoe UI", 8.5f);
            subtitle.ForeColor = Muted;
            subtitle.AutoSize = false;
            subtitle.Height = 23;
            subtitle.Location = new Point(15, 68);
            subtitle.Width = card.Width - 30;
            subtitle.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            card.Controls.Add(subtitle);

            Label flags = new Label();
            flags.Text =
                (tool.RequiresAdmin ? "ADMIN  " : "") +
                (tool.RequiresRestart ? "RESTART  " : "") +
                "OFFLINE:" + (tool.OfflineCapability ?? "-");
            flags.Font = new Font("Consolas", 7.8f);
            flags.ForeColor = Color.FromArgb(175, 200, 222);
            flags.AutoSize = true;
            flags.Location = new Point(15, 98);
            card.Controls.Add(flags);

            GlassButton analyze = new GlassButton();
            analyze.Text = arabic ? "تحليل" : "Analyze";
            analyze.Width = 86;
            analyze.Height = 33;
            analyze.Location = new Point(15, 119);
            analyze.FillColor = Color.FromArgb(150, 20, 92, 100);
            analyze.Click += async delegate
            {
                SelectTool(tool);
                await RunSelectedTool(true);
            };
            card.Controls.Add(analyze);

            GlassButton run = new GlassButton();
            run.Text = arabic ? "تشغيل" : "Run";
            run.Width = 86;
            run.Height = 33;
            run.Location = new Point(107, 119);
            run.FillColor = Color.FromArgb(170, 28, 80, 126);
            run.Click += async delegate
            {
                SelectTool(tool);
                await RunSelectedTool(false);
            };
            card.Controls.Add(run);

            EventHandler select = delegate { SelectTool(tool); };
            card.Click += select;
            title.Click += select;
            subtitle.Click += select;
            id.Click += select;
            risk.Click += select;
            flags.Click += select;

            return card;
        }

        private void SelectTool(ToolItem tool)
        {
            selectedTool = tool;

            detailTitle.Text = arabic && !String.IsNullOrEmpty(tool.ArabicName)
                ? tool.ArabicName
                : tool.EnglishName;
            detailSubTitle.Text = tool.ToolId + "  |  " + tool.EnglishName;
            detailPurpose.Text = tool.Purpose ?? "";
            detailMeta.Text =
                "Risk: " + tool.RiskLevel +
                "\r\nAdmin: " + tool.RequiresAdmin +
                "   Restart: " + tool.RequiresRestart +
                "   Offline: " + tool.OfflineCapability +
                "\r\nPath: " + tool.ScriptPath;
        }

        private async Task RunSelectedTool(bool analyze)
        {
            if (selectedTool == null)
            {
                MessageBox.Show(
                    arabic ? "اختر أداة أولاً." : "Select a tool first.",
                    "KNOUX Repair",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            if (operationRunning)
            {
                MessageBox.Show(
                    arabic ? "هناك عملية تعمل بالفعل." : "Another operation is already running.",
                    "KNOUX Repair",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            string script = Path.Combine(
                projectRoot,
                selectedTool.ScriptPath.Replace('/', Path.DirectorySeparatorChar));

            if (!File.Exists(script))
            {
                MessageBox.Show(
                    "Script not found:\r\n" + script,
                    "KNOUX Repair",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            if (!analyze)
            {
                DialogResult answer = MessageBox.Show(
                    arabic
                        ? "سيتم تشغيل الأداة في الوضع الفعلي.\r\nراجع مستوى الخطورة والنسخ الاحتياطي قبل المتابعة."
                        : "The tool will run in normal mode.\r\nReview its risk and backup requirements before continuing.",
                    "KNOUX Repair",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);

                if (answer != DialogResult.Yes) return;
            }

            string arguments =
                "-NoLogo -NoProfile -ExecutionPolicy Bypass -File " +
                Quote(script) +
                (analyze ? " -AnalyzeOnly" : "");

            await RunPowerShellProcess(arguments, selectedTool.ToolId + " - " + selectedTool.EnglishName);
        }

        private async Task RunTestSuite()
        {
            string tests = Path.Combine(projectRoot, "Tests", "Run-Tests.ps1");
            if (!File.Exists(tests))
            {
                MessageBox.Show("Tests\\Run-Tests.ps1 was not found.", "KNOUX Repair");
                return;
            }

            string arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File " + Quote(tests);
            await RunPowerShellProcess(arguments, "KNOUX Repair Test Suite");
        }

        private async Task RunPowerShellProcess(string arguments, string operationTitle)
        {
            operationRunning = true;
            SetRunningState(true);
            AppendLog("", Color.White);
            AppendLog("============================================================", Cyan);
            AppendLog("[RUN] " + operationTitle, Color.LightGreen);
            AppendLog("============================================================", Cyan);
            statusLabel.Text = arabic ? "قيد التنفيذ" : "Running";
            statusLabel.ForeColor = Gold;

            Process process = new Process();
            process.StartInfo = new ProcessStartInfo();
            process.StartInfo.FileName = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.System),
                "WindowsPowerShell",
                "v1.0",
                "powershell.exe");

            if (!File.Exists(process.StartInfo.FileName))
            {
                process.StartInfo.FileName = "powershell.exe";
            }

            process.StartInfo.Arguments = arguments;
            process.StartInfo.WorkingDirectory = projectRoot;
            process.StartInfo.UseShellExecute = false;
            process.StartInfo.CreateNoWindow = true;
            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.RedirectStandardError = true;
            process.StartInfo.RedirectStandardInput = true;
            process.StartInfo.StandardOutputEncoding = Encoding.UTF8;
            process.StartInfo.StandardErrorEncoding = Encoding.UTF8;
            process.EnableRaisingEvents = true;
            currentProcess = process;

            try
            {
                process.Start();

                Task outputTask = PumpReader(process.StandardOutput, Color.Gainsboro);
                Task errorTask = PumpReader(process.StandardError, Color.Salmon);
                Task waitTask = Task.Run(delegate { process.WaitForExit(); });

                await Task.WhenAll(outputTask, errorTask, waitTask);

                int exitCode = process.ExitCode;
                AppendLog("", Color.White);
                AppendLog(
                    "[EXIT] " + exitCode,
                    exitCode == 0 ? Color.LightGreen : Color.OrangeRed);

                statusLabel.Text = exitCode == 0
                    ? (arabic ? "اكتملت العملية" : "Completed")
                    : (arabic ? "انتهت بتحذير أو خطأ" : "Completed with warning/error");
                statusLabel.ForeColor = exitCode == 0 ? Color.LightGreen : Color.Orange;
            }
            catch (Exception ex)
            {
                AppendLog("[FAILED] " + ex.Message, Color.OrangeRed);
                statusLabel.Text = arabic ? "فشل التشغيل" : "Launch failed";
                statusLabel.ForeColor = Color.Red;
            }
            finally
            {
                try { process.Dispose(); } catch { }
                currentProcess = null;
                operationRunning = false;
                SetRunningState(false);
                RefreshDashboard();
            }
        }

        private async Task PumpReader(StreamReader reader, Color color)
        {
            char[] buffer = new char[256];

            while (true)
            {
                int count = await reader.ReadAsync(buffer, 0, buffer.Length);
                if (count <= 0) break;

                string text = new string(buffer, 0, count);
                AppendLogChunk(text, color);
            }
        }

        private void SendProcessInput()
        {
            if (!operationRunning || currentProcess == null || currentProcess.HasExited) return;

            string input = inputBox.Text;
            if (String.IsNullOrWhiteSpace(input)) return;

            try
            {
                currentProcess.StandardInput.WriteLine(input);
                currentProcess.StandardInput.Flush();
                AppendLog("> " + input, Gold);
                inputBox.Clear();
            }
            catch (Exception ex)
            {
                AppendLog("[INPUT FAILED] " + ex.Message, Color.OrangeRed);
            }
        }

        private void CancelCurrentProcess()
        {
            if (currentProcess == null || currentProcess.HasExited) return;

            DialogResult answer = MessageBox.Show(
                arabic ? "إيقاف الأداة الحالية؟" : "Stop the current tool?",
                "KNOUX Repair",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning);

            if (answer != DialogResult.Yes) return;

            try
            {
                currentProcess.Kill();
                AppendLog("[CANCELLED] Process terminated by user.", Color.Orange);
            }
            catch (Exception ex)
            {
                AppendLog("[CANCEL FAILED] " + ex.Message, Color.OrangeRed);
            }
        }

        private void SetRunningState(bool running)
        {
            progress.MarqueeAnimationSpeed = running ? 28 : 0;
            inputBox.Enabled = running;
            sendInputButton.Enabled = running;
            cancelButton.Enabled = running;
            runButton.Enabled = !running;
            analyzeButton.Enabled = !running;
        }

        private void OpenReports()
        {
            string path = Path.Combine(projectRoot, "Reports");
            Directory.CreateDirectory(path);

            try
            {
                Process.Start("explorer.exe", Quote(path));
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "KNOUX Repair");
            }
        }

        private void AppendLog(string text, Color color)
        {
            AppendLogChunk(text + Environment.NewLine, color);
        }

        private void AppendLogChunk(string text, Color color)
        {
            if (logBox == null) return;

            if (logBox.InvokeRequired)
            {
                logBox.BeginInvoke(new Action<string, Color>(AppendLogChunk), text, color);
                return;
            }

            logBox.SelectionStart = logBox.TextLength;
            logBox.SelectionLength = 0;
            logBox.SelectionColor = color;
            logBox.AppendText(text);
            logBox.SelectionColor = logBox.ForeColor;
            logBox.ScrollToCaret();
        }

        private void DragForm(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left && WindowState != FormWindowState.Maximized)
            {
                NativeMethods.ReleaseCapture();
                NativeMethods.SendMessage(Handle, NativeMethods.WM_NCLBUTTONDOWN, NativeMethods.HT_CAPTION, 0);
            }
        }

        private static bool Contains(string value, string query)
        {
            return !String.IsNullOrEmpty(value) &&
                   value.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private Color RiskColor(string risk)
        {
            switch ((risk ?? "").ToUpperInvariant())
            {
                case "READ_ONLY": return Cyan;
                case "SAFE_CLEANUP": return Color.LightGreen;
                case "SYSTEM_REPAIR": return Gold;
                case "DESTRUCTIVE": return Color.FromArgb(255, 100, 105);
                case "REBOOT_REQUIRED": return Color.Orange;
                case "WINRE_ONLY": return Color.Violet;
                default: return Sky;
            }
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private static bool IsAdministrator()
        {
            try
            {
                WindowsIdentity identity = WindowsIdentity.GetCurrent();
                WindowsPrincipal principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
            catch
            {
                return false;
            }
        }
    }
}
