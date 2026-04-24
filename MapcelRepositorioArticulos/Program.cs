using MapcelRepositorioArticulos.DataService;
using MapcelRepositorioArticulos.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.FileProviders;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(
        path: "logs/log-.txt",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 14,
        shared: true
    )
    .CreateLogger();

builder.Host.UseSerilog();

// MVC + API controllers
builder.Services.AddControllersWithViews();

// DB connection factory (keep for later SQL repo)
builder.Services.AddTransient<SqlConnection>(_ =>
    new SqlConnection(builder.Configuration.GetConnectionString("DefaultConnection")));

// Authentication
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(1440);
        options.Cookie.Path="/nuevos/repositorioarticulos/produccion";
        options.LoginPath = "/Account/Login";
        options.SlidingExpiration = true;
    });

// Add all the needed services
builder.Services.AddSingleton<DirectoryBuilder>();
builder.Services.AddScoped<ITagsService, TagsService>();
builder.Services.AddScoped<IFilesService, FilesService>();
builder.Services.AddScoped<ICompaniesService, CompaniesService>();
builder.Services.AddScoped<IArticleAggregateService, ArticleAggregateService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UsePathBase("/nuevos/repositorioarticulos/produccion");
}
else
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapControllerRoute(
    name: "account",
    pattern: "Account/{action=Login}/{id?}",
    defaults: new { controller = "Account" });

app.MapControllerRoute(
    name: "all_companies",
    pattern: "Companies/{controller=Companies}/{action=Index}");

app.MapControllerRoute(
    name: "company_route",
    pattern: "{companyId}/{controller=Home}/{action=Index}/{id?}");


app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();