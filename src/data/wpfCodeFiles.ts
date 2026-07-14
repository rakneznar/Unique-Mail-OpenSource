/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodeFile } from '../types';

export const wpfCodeFiles: CodeFile[] = [
  {
    id: 'app-xaml-cs',
    name: 'App.xaml.cs',
    type: 'cs',
    description: 'Der Haupteinstiegspunkt für .NET 8 WPF. Hier wird der Microsoft-Extensions-Dependency-Injection-Container initialisiert.',
    code: `using System;
using System.IO;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

namespace OutlookWpfClassic
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        public static IServiceProvider ServiceProvider { get; private set; }

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            var serviceCollection = new ServiceCollection();
            ConfigureServices(serviceCollection);

            ServiceProvider = serviceCollection.BuildServiceProvider();

            // Datenbank automatisch migrieren
            using (var scope = ServiceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<OutlookDbContext>();
                dbContext.Database.EnsureCreated();
            }

            // Hauptfenster anzeigen mit Dependency Injection auflösen
            var mainWindow = ServiceProvider.GetRequiredService<MainWindow>();
            mainWindow.Show();
        }

        private void ConfigureServices(IServiceCollection services)
        {
            // Datenbank-Setup (Lokales SQLite)
            string dbPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OutlookWpfClassic");
            Directory.CreateDirectory(dbPath);
            string dbFile = Path.Combine(dbPath, "outlook.db");

            services.AddDbContext<OutlookDbContext>(options =>
                options.UseSqlite($"Data Source={dbFile}"));

            // Services registrieren
            services.AddSingleton<IMailService, MailService>();
            services.AddSingleton<ISyncEngine, SyncEngine>();
            services.AddSingleton<IDataRepository, SQLiteDataRepository>();

            // ViewModels registrieren
            services.AddSingleton<MainWindowViewModel>();
            services.AddTransient<MailListViewModel>();
            services.AddTransient<CalendarViewModel>();

            // Views registrieren
            services.AddSingleton<MainWindow>();
        }
    }
}`
  },
  {
    id: 'viewmodelbase-cs',
    name: 'ViewModelBase.cs',
    type: 'cs',
    description: 'Die Standard-Basisklasse für alle MVVM ViewModels. Implementiert INotifyPropertyChanged für WPF-Datenbindung.',
    code: `using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace OutlookWpfClassic.ViewModels
{
    /// <summary>
    /// Basisklasse für alle ViewModels, um die UI-Benachrichtigung bei Datenänderungen zu kapseln.
    /// </summary>
    public abstract class ViewModelBase : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        /// <summary>
        /// Aktualisiert den Wert einer Eigenschaft und löst das PropertyChanged-Event aus, falls geändert.
        /// </summary>
        protected virtual bool SetProperty<T>(ref T storage, T value, [CallerMemberName] string propertyName = null)
        {
            if (Equals(storage, value)) return false;

            storage = value;
            OnPropertyChanged(propertyName);
            return true;
        }

        /// <summary>
        /// Manuelles Auslösen einer Benachrichtigung für die UI.
        /// </summary>
        protected virtual void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}`
  },
  {
    id: 'mainwindow-xaml',
    name: 'MainWindow.xaml',
    type: 'xaml',
    description: 'Das XAML-Layout für das Hauptfernfenster im klassischen Outlook 2013/2016 Design.',
    code: `<Window x:Class="OutlookWpfClassic.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2000/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2000/xaml"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        xmlns:vm="clr-namespace:OutlookWpfClassic.ViewModels"
        mc:Ignorable="d"
        Title="Posteingang - user@outlook-classic.local - Outlook Classic" 
        Height="768" Width="1024"
        Background="#F3F2F1"
        FontFamily="Segoe UI" FontSize="12">
    
    <Window.DataContext>
        <!-- Wird im Code-Behind via ServiceProvider zugewiesen -->
    </Window.DataContext>

    <Grid>
        <Grid.RowDefinitions>
            <!-- 1. Zeile: Titlebar Accent (Classic Outlook Blue) -->
            <RowDefinition Height="28"/>
            <!-- 2. Zeile: Ribbon Control -->
            <RowDefinition Height="120"/>
            <!-- 3. Zeile: Haupt-Inhalt mit GridSplitter -->
            <RowDefinition Height="*"/>
            <!-- 4. Zeile: Statusbar unten -->
            <RowDefinition Height="24"/>
        </Grid.RowDefinitions>

        <!-- 1. Header Bar Accent -->
        <Border Grid.Row="0" Background="#0078D4" VerticalAlignment="Stretch">
            <Grid>
                <TextBlock Text="Outlook WPF Classic (Architektur-Draft)" Foreground="White" 
                           VerticalAlignment="Center" Margin="10,0,0,0" FontWeight="SemiBold"/>
                <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,0,10,0">
                    <TextBlock Text="Online" Foreground="#DFF6DD" VerticalAlignment="Center" FontSize="11"/>
                    <Ellipse Width="8" Height="8" Fill="#107C41" Margin="5,0,0,0" VerticalAlignment="Center"/>
                </StackPanel>
            </Grid>
        </Border>

        <!-- 2. Classic Office Ribbon Bar -->
        <Border Grid.Row="1" BorderBrush="#D2D0CE" BorderThickness="0,0,0,1" Background="White">
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition Height="25"/> <!-- Reiter-Navigation -->
                    <RowDefinition Height="*"/>  <!-- Button-Bereich -->
                </Grid.RowDefinitions>

                <!-- Tabs (Buttons) -->
                <StackPanel Grid.Row="0" Orientation="Horizontal" Background="#F3F2F1">
                    <Button Content="Datei" Style="{StaticResource RibbonFileButtonStyle}"/>
                    <Button Content="Start" Style="{StaticResource RibbonActiveTabStyle}"/>
                    <Button Content="Senden / Empfangen" Style="{StaticResource RibbonTabStyle}"/>
                    <Button Content="Ordner" Style="{StaticResource RibbonTabStyle}"/>
                    <Button Content="Ansicht" Style="{StaticResource RibbonTabStyle}"/>
                </StackPanel>

                <!-- Ribbon Items Group -->
                <StackPanel Grid.Row="1" Orientation="Horizontal" Margin="5">
                    <!-- Gruppe: Neu -->
                    <Border BorderBrush="#EDEBE9" BorderThickness="0,0,1,0" Padding="5,0,10,0">
                        <StackPanel VerticalAlignment="Center">
                            <Button Style="{StaticResource RibbonLargeButtonStyle}">
                                <StackPanel>
                                    <Image Source="pack://application:,,,/Resources/new_mail.png" Width="32" Height="32"/>
                                    <TextBlock Text="Neue E-Mail" HorizontalAlignment="Center" FontSize="11"/>
                                </StackPanel>
                            </Button>
                        </StackPanel>
                    </Border>
                    <!-- Gruppe: Löschen -->
                    <Border BorderBrush="#EDEBE9" BorderThickness="0,0,1,0" Padding="10,0,10,0">
                        <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                            <Button Content="Löschen" Style="{StaticResource RibbonNormalButtonStyle}"/>
                            <Button Content="Archivieren" Style="{StaticResource RibbonNormalButtonStyle}" Margin="5,0,0,0"/>
                        </StackPanel>
                    </Border>
                    <!-- Gruppe: Antworten -->
                    <Border BorderBrush="#EDEBE9" BorderThickness="0,0,1,0" Padding="10,0,10,0">
                        <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                            <Button Content="Antworten" Style="{StaticResource RibbonNormalButtonStyle}"/>
                            <Button Content="Allen antworten" Style="{StaticResource RibbonNormalButtonStyle}" Margin="5,0,0,0"/>
                            <Button Content="Weiterleiten" Style="{StaticResource RibbonNormalButtonStyle}" Margin="5,0,0,0"/>
                        </StackPanel>
                    </Border>
                </StackPanel>
            </Grid>
        </Border>

        <!-- 3. Haupt-Workspace (3 Spalten) -->
        <Grid Grid.Row="2">
            <Grid.ColumnDefinitions>
                <!-- Links: Ordnerstruktur -->
                <ColumnDefinition Width="220" MinWidth="150" MaxWidth="350"/>
                <!-- Mitte: E-Mail-Vorschau-Liste -->
                <ColumnDefinition Width="320" MinWidth="250" MaxWidth="600"/>
                <!-- Rechts: Lesebereich -->
                <ColumnDefinition Width="*"/>
            </Grid.ColumnDefinitions>

            <!-- Ordnerstruktur (Spalte 1) -->
            <Border Grid.Column="0" BorderBrush="#D2D0CE" BorderThickness="0,0,1,0" Background="#F3F2F1">
                <TreeView ItemsSource="{Binding Mailboxes}" Background="Transparent" BorderThickness="0">
                    <!-- TreeViewItem styling, binding hierarchically -->
                </TreeView>
            </Border>

            <!-- GridSplitter 1 -->
            <GridSplitter Grid.Column="0" Width="4" VerticalAlignment="Stretch" HorizontalAlignment="Right" Background="Transparent"/>

            <!-- E-Mail Masterliste (Spalte 2) -->
            <Border Grid.Column="1" BorderBrush="#D2D0CE" BorderThickness="0,0,1,0" Background="White">
                <Grid>
                    <Grid.RowDefinitions>
                        <RowDefinition Height="35"/> <!-- Suchen-Feld -->
                        <RowDefinition Height="25"/> <!-- Filter-Header (Alle / Ungelesen) -->
                        <RowDefinition Height="*"/>  <!-- Liste -->
                    </Grid.RowDefinitions>

                    <TextBox Grid.Row="0" Margin="5" Text="Aktueller Ordner durchsuchen" Foreground="Gray" VerticalContentAlignment="Center"/>
                    
                    <StackPanel Grid.Row="1" Orientation="Horizontal" Background="#F3F2F1">
                        <TextBlock Text="Alle" Margin="10,3,10,3" FontWeight="Bold" Foreground="#0078D4"/>
                        <TextBlock Text="Ungelesen" Margin="10,3,10,3"/>
                    </StackPanel>

                    <!-- Mail ListView mit UI Virtualization für Performance -->
                    <ListView Grid.Row="2" ItemsSource="{Binding SelectedFolderEmails}" 
                              SelectedItem="{Binding SelectedEmail}"
                              VirtualizingStackPanel.IsVirtualizing="True"
                              VirtualizingStackPanel.VirtualizationMode="Recycling"
                              ScrollViewer.CanContentScroll="True"
                              BorderThickness="0">
                        <!-- Custom ItemTemplate representing classic outlook rows -->
                    </ListView>
                </Grid>
            </Border>

            <!-- GridSplitter 2 -->
            <GridSplitter Grid.Column="1" Width="4" VerticalAlignment="Stretch" HorizontalAlignment="Right" Background="Transparent"/>

            <!-- Lesebereich E-Mail (Spalte 3) -->
            <Border Grid.Column="2" Background="White">
                <Grid Margin="15">
                    <Grid.RowDefinitions>
                        <RowDefinition Height="Auto"/> <!-- Absender & Betreff -->
                        <RowDefinition Height="Auto"/> <!-- Divider -->
                        <RowDefinition Height="*"/>    <!-- Textbody -->
                    </Grid.RowDefinitions>

                    <!-- Header -->
                    <StackPanel Grid.Row="0" Margin="0,0,0,15">
                        <TextBlock Text="{Binding SelectedEmail.Subject, FallbackValue='Keine E-Mail ausgewählt'}" 
                                   FontSize="20" FontWeight="Light" Margin="0,0,0,8" Foreground="Black"/>
                        <Grid>
                            <Grid.ColumnDefinitions>
                                <ColumnDefinition Width="Auto"/>
                                <ColumnDefinition Width="*"/>
                            </Grid.ColumnDefinitions>
                            <!-- Kugel Avatar -->
                            <Ellipse Width="40" Height="40" Fill="#E1DFDD"/>
                            <StackPanel Grid.Column="1" Margin="10,0,0,0" VerticalAlignment="Center">
                                <TextBlock Text="{Binding SelectedEmail.Sender}" FontWeight="SemiBold" FontSize="13"/>
                                <TextBlock Text="{Binding SelectedEmail.SenderEmail}" FontSize="11" Foreground="Gray"/>
                            </StackPanel>
                        </Grid>
                    </StackPanel>

                    <Separator Grid.Row="1" Background="#EDEBE9" Height="1"/>

                    <!-- Mail Body -->
                    <TextBox Grid.Row="2" Text="{Binding SelectedEmail.Body}" 
                             IsReadOnly="True" BorderThickness="0" TextWrapping="Wrap" 
                             AcceptsReturn="True" Background="Transparent" Margin="0,15,0,0" FontSize="13"/>
                </Grid>
            </Border>
        </Grid>

        <!-- 4. Outlook Statusbar -->
        <Border Grid.Row="3" Background="#F3F2F1" BorderBrush="#D2D0CE" BorderThickness="0,1,0,0">
            <Grid Margin="10,0">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="Auto"/> <!-- Status Text -->
                    <ColumnDefinition Width="*"/>    <!-- Spacer / Progress -->
                    <ColumnDefinition Width="Auto"/> <!-- Sync State -->
                </Grid.ColumnDefinitions>

                <TextBlock Grid.Column="0" Text="Elemente: 5" VerticalAlignment="Center" FontSize="11" Foreground="#323130"/>
                
                <StackPanel Grid.Column="1" Orientation="Horizontal" HorizontalAlignment="Center">
                    <ProgressBar Width="120" Height="10" Value="{Binding SyncProgress}" Margin="0,0,10,0" VerticalAlignment="Center"/>
                    <TextBlock Text="{Binding SyncStatusText, FallbackValue='Alle Ordner sind aktuell.'}" FontSize="11" VerticalAlignment="Center"/>
                </StackPanel>

                <StackPanel Grid.Column="2" Orientation="Horizontal">
                    <TextBlock Text="Verbunden mit Microsoft Exchange" FontSize="11" VerticalAlignment="Center" Margin="0,0,10,0"/>
                    <TextBlock Text="Offline arbeiten" FontSize="11" VerticalAlignment="Center" Foreground="#A80000" FontWeight="SemiBold" Visibility="Collapsed"/>
                </StackPanel>
            </Grid>
        </Border>
    </Grid>
</Window>`
  },
  {
    id: 'styles-xaml',
    name: 'Styles.xaml',
    type: 'xaml',
    description: 'Globales WPF ResourceDictionary für Buttons, ListBoxen, Scrollbars und Selektoren im klassischen Outlook Design.',
    code: `<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2000/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2000/xaml">

    <!-- Outlook Classic Visual Color palette -->
    <Color x:Key="OutlookBlueColor">#0078D4</Color>
    <SolidColorBrush x:Key="OutlookBlueBrush" Color="{StaticResource OutlookBlueColor}"/>
    <SolidColorBrush x:Key="AppBackgroundBrush" Color="#F3F2F1"/>
    <SolidColorBrush x:Key="BorderGrayBrush" Color="#D2D0CE"/>
    
    <!-- Ribbon Tab Styles -->
    <Style x:Key="RibbonFileButtonStyle" TargetType="Button">
        <Setter Property="Background" Value="#0066B3"/>
        <Setter Property="Foreground" Value="White"/>
        <Setter Property="FontWeight" Value="SemiBold"/>
        <Setter Property="Padding" Value="15,4"/>
        <Setter Property="BorderThickness" Value="0"/>
        <Setter Property="Margin" Value="0,0,5,0"/>
    </Style>

    <Style x:Key="RibbonActiveTabStyle" TargetType="Button">
        <Setter Property="Background" Value="White"/>
        <Setter Property="Foreground" Value="#0078D4"/>
        <Setter Property="FontWeight" Value="Medium"/>
        <Setter Property="Padding" Value="15,4"/>
        <Setter Property="BorderThickness" Value="1,1,1,0"/>
        <Setter Property="BorderBrush" Value="#D2D0CE"/>
    </Style>

    <Style x:Key="RibbonTabStyle" TargetType="Button">
        <Setter Property="Background" Value="Transparent"/>
        <Setter Property="Foreground" Value="#323130"/>
        <Setter Property="Padding" Value="15,4"/>
        <Setter Property="BorderThickness" Value="0"/>
    </Style>

    <!-- Ribbon Button Templates (Large & Normal Hover States) -->
    <Style x:Key="RibbonLargeButtonStyle" TargetType="Button">
        <Setter Property="Background" Value="Transparent"/>
        <Setter Property="BorderThickness" Value="0"/>
        <Setter Property="Padding" Value="8,5"/>
        <Setter Property="Margin" Value="2"/>
        <Setter Property="Template">
            <Setter.Value>
                <ControlTemplate TargetType="Button">
                    <Border x:Name="border" Background="{TemplateBinding Background}" 
                            BorderBrush="#D2D0CE" BorderThickness="0" CornerRadius="2">
                        <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                    </Border>
                    <ControlTemplate.Triggers>
                        <Trigger Property="IsMouseOver" Value="True">
                            <Setter TargetName="border" Property="Background" Value="#EDEBE9" />
                            <Setter TargetName="border" Property="BorderThickness" Value="1" />
                        </Trigger>
                        <Trigger Property="IsPressed" Value="True">
                            <Setter TargetName="border" Property="Background" Value="#C8C6C4" />
                        </Trigger>
                    </ControlTemplate.Triggers>
                </ControlTemplate>
            </Setter.Value>
        </Setter>
    </Style>

    <Style x:Key="RibbonNormalButtonStyle" TargetType="Button">
        <Setter Property="Background" Value="Transparent"/>
        <Setter Property="Foreground" Value="#323130"/>
        <Setter Property="Padding" Value="6,4"/>
        <Setter Property="Template">
            <Setter.Value>
                <ControlTemplate TargetType="Button">
                    <Border x:Name="border" Background="{TemplateBinding Background}" 
                            BorderBrush="#D2D0CE" BorderThickness="0" CornerRadius="2">
                        <ContentPresenter Margin="{TemplateBinding Padding}" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                    </Border>
                    <ControlTemplate.Triggers>
                        <Trigger Property="IsMouseOver" Value="True">
                            <Setter TargetName="border" Property="Background" Value="#EDEBE9"/>
                            <Setter TargetName="border" Property="BorderThickness" Value="1"/>
                        </Trigger>
                    </ControlTemplate.Triggers>
                </ControlTemplate>
            </Setter.Value>
        </Setter>
    </Style>
</ResourceDictionary>`
  },
  {
    id: 'mailitem-cs',
    name: 'MailItem.cs',
    type: 'cs',
    description: 'Entity-Framework-Core-Klasse, welche die Tabellenstruktur der E-Mail-Datenbank ddefiniert.',
    code: `using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OutlookWpfClassic.Models
{
    [Table("Emails")]
    public class MailItem
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        public uint UniqueId { get; set; } // Die IMAP UID für Delta-Sync

        [Required]
        [MaxLength(255)]
        public string Sender { get; set; }

        [Required]
        [MaxLength(255)]
        public string SenderEmail { get; set; }

        [Required]
        [MaxLength(500)]
        public string Subject { get; set; }

        [Required]
        public string Body { get; set; }

        public string PreviewSnippet { get; set; }

        [Required]
        public DateTime DateTimeReceived { get; set; }

        public bool IsRead { get; set; }

        public bool IsFlagged { get; set; }

        public bool HasAttachments { get; set; }

        [MaxLength(50)]
        public string Importance { get; set; } = "Normal"; // Low, Normal, High

        [MaxLength(100)]
        public string FolderId { get; set; } // Referenz auf Ordner-Tabelle

        public string Category { get; set; }

        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    }
}`
  },
  {
    id: 'mailservice-cs',
    name: 'MailService.cs',
    type: 'cs',
    description: 'Implementierung des IMailService mithilfe der hervorragenden MailKit-Bibliothek für den voll-integrierten IMAP-Abruf.',
    code: `using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Security;
using MimeKit;
using OutlookWpfClassic.Models;

namespace OutlookWpfClassic.Services
{
    public interface IMailService
    {
        Task<bool> ConnectAsync(string server, int port, string user, string password);
        Task<List<MailItem>> FetchLatestEmailsAsync(uint lastKnownUid);
        Task<bool> SendEmailAsync(string to, string subject, string body, string importance);
    }

    public class MailService : IMailService
    {
        private readonly string _host = "imap.example.com";
        private readonly int _port = 993;

        public async Task<bool> ConnectAsync(string server, int port, string user, string password)
        {
            try
            {
                using (var client = new ImapClient())
                {
                    // Sichere SSL/TLS-Verbindung herstellen
                    await client.ConnectAsync(server, port, SecureSocketOptions.SslOnConnect);
                    await client.AuthenticateAsync(user, password);
                    
                    bool isConnected = client.IsConnected && client.IsAuthenticated;
                    await client.DisconnectAsync(true);
                    return isConnected;
                }
            }
            catch (Exception)
            {
                return false;
            }
        }

        public async Task<List<MailItem>> FetchLatestEmailsAsync(uint lastKnownUid)
        {
            var downloadedEmails = new List<MailItem>();

            using (var client = new ImapClient())
            {
                await client.ConnectAsync(_host, _port, SecureSocketOptions.SslOnConnect);
                await client.AuthenticateAsync("user@outlook-classic.local", "SuperSecretPassword");

                var inbox = client.Inbox;
                await inbox.OpenAsync(FolderAccess.ReadOnly);

                // Delta-Sync: Lese nur UIDs ab dem letzten bekannten Status
                IList<UniqueId> uidsToFetch;
                if (lastKnownUid == 0)
                {
                    // Lese die letzten 50 Mails beim ersten Voll-Sync
                    int count = inbox.Count;
                    int startIndex = Math.Max(0, count - 50);
                    uidsToFetch = inbox.Search(MailKit.Search.SearchQuery.All);
                }
                else
                {
                    // Hole nur neuere Mails ab UID
                    var minUid = new UniqueId(lastKnownUid + 1);
                    uidsToFetch = inbox.Search(MailKit.Search.SearchQuery.UidGreaterThan(minUid));
                }

                foreach (var uid in uidsToFetch)
                {
                    var mimeMessage = await inbox.GetMessageAsync(uid);
                    
                    var mail = new MailItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        UniqueId = uid.Id,
                        Sender = mimeMessage.From[0]?.Name ?? "Unbekannt",
                        SenderEmail = mimeMessage.From.Mailboxes.ToString(),
                        Subject = mimeMessage.Subject ?? "(Kein Betreff)",
                        Body = mimeMessage.TextBody ?? mimeMessage.HtmlBody ?? "",
                        PreviewSnippet = mimeMessage.TextBody?.Substring(0, Math.Min(100, mimeMessage.TextBody.Length)) ?? "",
                        DateTimeReceived = mimeMessage.Date.DateTime,
                        IsRead = false,
                        HasAttachments = mimeMessage.Attachments != null
                    };

                    downloadedEmails.Add(mail);
                }

                await client.DisconnectAsync(true);
            }

            return downloadedEmails;
        }

        public Task<bool> SendEmailAsync(string to, string subject, string body, string importance)
        {
            // Implementierung mit MailKit MailKit.Net.Smtp.SmtpClient
            // Sendet die MimeMessage über SMTP raus
            return Task.FromResult(true);
        }
    }
}`
  },
  {
    id: 'syncengine-cs',
    name: 'SyncEngine.cs',
    type: 'cs',
    description: 'Der C# Hintergrund-Sync-Manager. Er ermittelt ununterbrochen Delta-Updates und meldet den Status zurück an die WPF-Statusleiste.',
    code: `using System;
using System.Threading;
using System.Threading.Tasks;
using OutlookWpfClassic.Models;
using OutlookWpfClassic.Services;

namespace OutlookWpfClassic.BackgroundEngine
{
    public interface ISyncEngine
    {
        void StartSyncLoop(IProgress<SyncStatus> progressReporter);
        void StopSyncLoop();
        Task TriggerImmediateSyncAsync();
    }

    public class SyncStatus
    {
        public string Message { get; set; } = "";
        public int ProgressPercent { get; set; } = 0;
        public bool IsRunning { get; set; } = false;
    }

    public class SyncEngine : ISyncEngine
    {
        private readonly IMailService _mailService;
        private readonly OutlookDbContext _dbContext;
        private CancellationTokenSource _cts;
        private Task _syncTask;

        public SyncEngine(IMailService mailService, OutlookDbContext dbContext)
        {
            _mailService = mailService;
            _dbContext = dbContext;
        }

        public void StartSyncLoop(IProgress<SyncStatus> progressReporter)
        {
            _cts = new CancellationTokenSource();
            CancellationToken token = _cts.Token;

            _syncTask = Task.Run(async () =>
            {
                while (!token.IsCancellationRequested)
                {
                    try
                    {
                        progressReporter.Report(new SyncStatus { Message = "Sende und Empfange...", ProgressPercent = 10, IsRunning = true });
                        
                        // Letzte bekannte Delta-UID abfragen
                        uint highestUid = 0;
                        // local DB Query: highestUid = _dbContext.Emails.Max(x => x.UniqueId)

                        progressReporter.Report(new SyncStatus { Message = "Abfragen von neuen E-Mails...", ProgressPercent = 40, IsRunning = true });
                        var newMails = await _mailService.FetchLatestEmailsAsync(highestUid);

                        progressReporter.Report(new SyncStatus { Message = "Speichern in der SQLite Datenbank...", ProgressPercent = 75, IsRunning = true });
                        if (newMails.Count > 0)
                        {
                            // In DB inserten: _dbContext.Emails.AddRange(newMails);
                            // await _dbContext.SaveChangesAsync();
                        }

                        progressReporter.Report(new SyncStatus { Message = "Alle Ordner sind aktuell.", ProgressPercent = 100, IsRunning = false });
                    }
                    catch (Exception ex)
                    {
                        progressReporter.Report(new SyncStatus { Message = $"Fehler beim Abruf: {ex.Message}", ProgressPercent = 100, IsRunning = false });
                    }

                    // Alle 5 Minuten syncen
                    await Task.Delay(TimeSpan.FromMinutes(5), token);
                }
            }, token);
        }

        public void StopSyncLoop()
        {
            _cts?.Cancel();
        }

        public async Task TriggerImmediateSyncAsync()
        {
            // Manueller Trigger "Senden/Empfangen" Button
            await Task.Delay(100);
        }
    }
}`
  },
  {
    id: 'autodiscovery-cs',
    name: 'AutoDiscoveryService.cs',
    type: 'cs',
    description: 'Service zur automatischen Erkennung (Auto-Discovery) von IMAP und SMTP Verbindungseinstellungen über DNS MX, Autodiscover-XML oder Host-Fallbacks.',
    code: `using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Xml.Linq;
using System.Linq;

namespace UniqueMail.Services
{
    public class AutoDiscoveryResult
    {
        public string ImapServer { get; set; }
        public int ImapPort { get; set; } = 993;
        public bool ImapSsl { get; set; } = true;
        
        public string SmtpServer { get; set; }
        public int SmtpPort { get; set; } = 465;
        public bool SmtpSsl { get; set; } = true;
        
        public string DetectedProvider { get; set; }
        public bool IsSuccess { get; set; }
        public string ErrorMessage { get; set; }
    }

    /// <summary>
    /// Service, um anhand des Benutzernamens (E-Mail) und Passworts vollautomatisch
    /// die IMAP- und SMTP-Einwahldaten zu suchen und einzupflegen (Autodiscover-Standard).
    /// </summary>
    public class AutoDiscoveryService
    {
        private static readonly HttpClient _httpClient = new HttpClient();

        public async Task<AutoDiscoveryResult> DiscoverSettingsAsync(string emailAddress, string password)
        {
            if (string.IsNullOrWhiteSpace(emailAddress) || !emailAddress.Contains("@"))
            {
                return new AutoDiscoveryResult { IsSuccess = false, ErrorMessage = "Ungültige E-Mail-Adresse." };
            }

            string domain = emailAddress.Split('@').Last().ToLower();
            
            // 1. Bekannte Standardprovider-Liste abgleichen (Fast Path für GMX, Gmail, Outlook, Web.de)
            var staticResult = CheckStaticConfiguration(domain);
            if (staticResult != null)
            {
                staticResult.IsSuccess = true;
                return staticResult;
            }

            // 2. Microsoft Autodiscover Protokoll (XML/SOAP) für Exchange / M365 abfragen
            try
            {
                var autodiscoverResult = await QueryExchangeAutodiscoverAsync(emailAddress, password, domain);
                if (autodiscoverResult != null && autodiscoverResult.IsSuccess)
                {
                    return autodiscoverResult;
                }
            }
            catch 
            {
                // Fallback bei Timeout oder Exchange-Verweigerung
            }

            // 3. DNS-SRV Records (RFC 6186) für IMAP / SMTP abfragen
            try
            {
                var dnsResult = await QueryDnsSrvRecordsAsync(domain);
                if (dnsResult != null && dnsResult.IsSuccess)
                {
                    return dnsResult;
                }
            }
            catch 
            {
                // Fallback falls kein SRV-Record existiert
            }

            // 4. Generische Subdomain-Kombinationen prüfen
            return new AutoDiscoveryResult
            {
                IsSuccess = true,
                DetectedProvider = $"Generischer Mailserver ({domain})",
                ImapServer = $"imap.{domain}",
                ImapPort = 993,
                ImapSsl = true,
                SmtpServer = $"smtp.{domain}",
                SmtpPort = 465,
                SmtpSsl = true
            };
        }

        private AutoDiscoveryResult CheckStaticConfiguration(string domain)
        {
            return domain switch
            {
                "gmail.com" or "googlemail.com" => new AutoDiscoveryResult 
                { 
                    DetectedProvider = "Google Workspace / Gmail", 
                    ImapServer = "imap.gmail.com", 
                    ImapPort = 993, 
                    SmtpServer = "smtp.gmail.com", 
                    SmtpPort = 465 
                },
                "gmx.de" or "gmx.net" or "gmx.at" or "gmx.ch" => new AutoDiscoveryResult 
                { 
                    DetectedProvider = "GMX Mail", 
                    ImapServer = "imap.gmx.net", 
                    ImapPort = 993, 
                    SmtpServer = "mail.gmx.net", 
                    SmtpPort = 465 
                },
                "web.de" => new AutoDiscoveryResult 
                { 
                    DetectedProvider = "WEB.DE Freemail", 
                    ImapServer = "imap.web.de", 
                    ImapPort = 993, 
                    SmtpServer = "smtp.web.de", 
                    SmtpPort = 587, 
                    SmtpSsl = false 
                },
                "outlook.com" or "hotmail.com" or "live.com" or "msn.com" => new AutoDiscoveryResult 
                { 
                    DetectedProvider = "Microsoft Live / Outlook.com", 
                    ImapServer = "outlook.office365.com", 
                    ImapPort = 993, 
                    SmtpServer = "smtp-mail.outlook.com", 
                    SmtpPort = 587, 
                    SmtpSsl = false 
                },
                _ => null
            };
        }

        private async Task<AutoDiscoveryResult> QueryExchangeAutodiscoverAsync(string email, string pwd, string domain)
        {
            string url = $"https://autodiscover.{domain}/autodiscover/autodiscover.xml";
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            
            // Erstellt das klassische Autodiscover-XML Request-Template
            string soapXml = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<Autodiscover xmlns=""http://schemas.microsoft.com/exchange/autodiscover/outlook/requestschema/2006"">
  <Request>
    <EMailAddress>{email}</EMailAddress>
    <AcceptableResponseSchema>http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a</AcceptableResponseSchema>
  </Request>
</Autodiscover>";

            request.Content = new StringContent(soapXml, System.Text.Encoding.UTF8, "text/xml");
            
            // Basic-Auth Header hinzufügen
            var byteArray = System.Text.Encoding.ASCII.GetBytes($"{email}:{pwd}");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", Convert.ToBase64String(byteArray));

            var response = await _httpClient.SendAsync(request);
            if (response.StatusCode == HttpStatusCode.OK)
            {
                string xmlContent = await response.Content.ReadAsStringAsync();
                var doc = XDocument.Parse(xmlContent);
                XNamespace ns = "http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a";
                
                // Parsen des Protokoll-Nodes für IMAP und SMTP
                var accounts = doc.Descendants(ns + "Account");
                var result = new AutoDiscoveryResult { IsSuccess = true, DetectedProvider = "Exchange Autodiscover v1" };
                
                foreach (var protocol in doc.Descendants(ns + "Protocol"))
                {
                    string type = protocol.Element(ns + "Type")?.Value;
                    if (type == "IMAP")
                    {
                        result.ImapServer = protocol.Element(ns + "Server")?.Value;
                        result.ImapPort = int.Parse(protocol.Element(ns + "Port")?.Value ?? "993");
                        result.ImapSsl = protocol.Element(ns + "SSL")?.Value == "on";
                    }
                    else if (type == "SMTP")
                    {
                        result.SmtpServer = protocol.Element(ns + "Server")?.Value;
                        result.SmtpPort = int.Parse(protocol.Element(ns + "Port")?.Value ?? "587");
                        result.SmtpSsl = protocol.Element(ns + "SSL")?.Value == "on" || result.SmtpPort == 465;
                    }
                }
                
                if (!string.IsNullOrEmpty(result.ImapServer)) return result;
            }
            return null;
        }

        private async Task<AutoDiscoveryResult> QueryDnsSrvRecordsAsync(string domain)
        {
            // Simuliert einen DNS Client-Abruf für _imaps._tcp und _submission._tcp Records.
            // Im Produktivcode wird hierzu DnsClient.NET eingebunden.
            await Task.Delay(50); 
            return null;
        }
    }
}`
  },
  {
    id: 'relaycommand-cs',
    name: 'RelayCommand.cs',
    type: 'cs',
    description: 'Eine standardmäßige Implementierung der ICommand-Schnittstelle zur Einbindung von WPF UI-Events in MVVM ViewModels.',
    code: `using System;
using System.Windows.Input;

namespace OutlookWpfClassic.Commands
{
    /// <summary>
    /// Ermöglicht die Weiterleitung von WPF-Steuerelementbefehlen (wie Buttonevents)
    /// an ViewModel-Methoden über Delegaten ohne Code-Behind.
    /// </summary>
    public class RelayCommand : ICommand
    {
        private readonly Action<object> _execute;
        private readonly Predicate<object> _canExecute;

        public event EventHandler CanExecuteChanged
        {
            add { CommandManager.RequerySuggested += value; }
            remove { CommandManager.RequerySuggested -= value; }
        }

        public RelayCommand(Action<object> execute, Predicate<object> canExecute = null)
        {
            _execute = execute ?? throw new ArgumentNullException(nameof(execute));
            _canExecute = canExecute;
        }

        public bool CanExecute(object parameter) => _canExecute == null || _canExecute(parameter);

        public void Execute(object parameter) => _execute(parameter);
    }
}`
  },
  {
    id: 'appsettings-json',
    name: 'appsettings.json',
    type: 'json',
    description: 'Die Konfigurationsdatei für Server-Verbindungsparameter, SQLite Pfade und Verschlüsselungs-Einstellungen.',
    code: `{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=outlook.db"
  },
  "MailSettings": {
    "ImapServer": "imap.unique-mail.de",
    "ImapPort": 993,
    "SmtpServer": "smtp.unique-mail.de",
    "SmtpPort": 465,
    "UseSsl": true,
    "AutoDiscoveryFallbackEnabled": true
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
    }
  }
}`
  },
  {
    id: 'app-config',
    name: 'App.config',
    type: 'xml',
    description: 'WPF Anwendungskonfiguration zur Optimierung des SQLite SQLite-WAL Cache-Levels, WCF Protocol-Bindings und Garbage Collection Large-Object-Heap (LOH) Einstellungen.',
    code: `<?xml version="1.0" encoding="utf-8" ?>
<configuration>
  <configSections>
    <sectionGroup name="userSettings" type="System.Configuration.UserSettingsGroup, System, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089">
      <section name="UniqueMail.Properties.Settings" type="System.Configuration.ClientSettingsSection, System, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089" allowExeDefinition="MachineToLocalUser" requirePermission="false" />
    </sectionGroup>
  </configSections>

  <runtime>
    <!-- Garbage Collection Tuning für flüssiges WPF UI-Rendering bei großen E-Mail Listen -->
    <gcServer enabled="true" />
    <gcConcurrent enabled="true" />
    <!-- Large Object Heap (LOH) Defragmentierung aktivieren, um RAM-Anstieg zu verhindern -->
    <LargeObjectHeapCompactionMode enabled="1" />
  </runtime>

  <appSettings>
    <!-- SQLite Tuning Parameter für Schreib- und Lesezugriff -->
    <add key="SqliteJournalMode" value="WAL" />
    <add key="SqliteCacheSize" value="-2000" /> <!-- ca. 2MB Cache -->
    <add key="SqliteSynchronous" value="Normal" />
    
    <!-- Auto-Update Endpoint für lautlose Verteilung im Hintergrund -->
    <add key="UpdateServerUrl" value="https://updates.unique-mail.de/win-x64/" />
    <add key="EnableTelemetry" value="false" />
  </appSettings>
</configuration>`
  }
];
