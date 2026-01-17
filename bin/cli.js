#!/usr/bin/env node

/**
 * Woo-HTML5-Convertor CLI
 * Convert WooCommerce stores to blazing-fast HTML5 static sites
 */

const { program } = require('commander');
const inquirer = require('inquirer');
const ora = require('ora');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const StoreBuilder = require('../src/builder');
const WooCommerceConnector = require('../src/importers/woocommerce-connector');

// Package info
const pkg = require('../package.json');

// ASCII Art Banner
const banner = `
${chalk.blue('╔═══════════════════════════════════════════════════════════╗')}
${chalk.blue('║')}  ${chalk.bold.white('Woo-HTML5-Convertor')} ${chalk.gray('v' + pkg.version)}                            ${chalk.blue('║')}
${chalk.blue('║')}  ${chalk.gray('Convert WooCommerce to blazing-fast HTML5 stores')}         ${chalk.blue('║')}
${chalk.blue('╚═══════════════════════════════════════════════════════════╝')}
`;

program
    .name('woo-convert')
    .description('Convert WooCommerce stores to blazing-fast HTML5 static sites')
    .version(pkg.version);

// Convert command
program
    .command('convert')
    .description('Convert a WooCommerce store to HTML5')
    .option('-u, --url <url>', 'WooCommerce site URL')
    .option('-k, --key <key>', 'WooCommerce Consumer Key')
    .option('-s, --secret <secret>', 'WooCommerce Consumer Secret')
    .option('-o, --output <dir>', 'Output directory', './output')
    .option('-n, --name <name>', 'Store name')
    .option('-c, --color <color>', 'Primary color (hex)', '#2563eb')
    .option('--no-images', 'Skip image optimization')
    .option('--no-pwa', 'Skip PWA generation')
    .option('-i, --interactive', 'Run in interactive mode')
    .action(async (options) => {
        console.log(banner);

        let config;

        if (options.interactive || (!options.url && !process.env.WOO_SITE_URL)) {
            config = await runInteractiveSetup();
        } else {
            config = {
                siteUrl: options.url || process.env.WOO_SITE_URL,
                consumerKey: options.key || process.env.WOO_CONSUMER_KEY,
                consumerSecret: options.secret || process.env.WOO_CONSUMER_SECRET,
                outputDir: path.resolve(options.output),
                siteName: options.name || 'My Store',
                primaryColor: options.color,
                optimizeImages: options.images !== false,
                enablePWA: options.pwa !== false
            };
        }

        await runConversion(config);
    });

// Test connection command
program
    .command('test')
    .description('Test connection to WooCommerce store')
    .option('-u, --url <url>', 'WooCommerce site URL')
    .option('-k, --key <key>', 'WooCommerce Consumer Key')
    .option('-s, --secret <secret>', 'WooCommerce Consumer Secret')
    .action(async (options) => {
        console.log(banner);

        const siteUrl = options.url || process.env.WOO_SITE_URL;
        const consumerKey = options.key || process.env.WOO_CONSUMER_KEY;
        const consumerSecret = options.secret || process.env.WOO_CONSUMER_SECRET;

        if (!siteUrl || !consumerKey || !consumerSecret) {
            console.log(chalk.red('Error: Missing WooCommerce credentials'));
            console.log('Please provide --url, --key, and --secret options');
            console.log('Or set WOO_SITE_URL, WOO_CONSUMER_KEY, WOO_CONSUMER_SECRET environment variables');
            process.exit(1);
        }

        const spinner = ora('Testing connection...').start();

        try {
            const connector = new WooCommerceConnector({
                siteUrl,
                consumerKey,
                consumerSecret
            });

            const result = await connector.testConnection();

            if (result.success) {
                spinner.succeed(chalk.green('Connection successful!'));
                console.log(`\n  Store: ${chalk.bold(result.storeName)}`);
                console.log(`  URL: ${result.storeUrl}`);
                console.log(`  WooCommerce Version: ${result.wcVersion}`);
            } else {
                spinner.fail(chalk.red('Connection failed'));
                console.log(`\n  Error: ${result.error}`);
                if (result.status === 401) {
                    console.log(chalk.yellow('  Tip: Check your Consumer Key and Secret'));
                }
            }
        } catch (error) {
            spinner.fail(chalk.red('Connection failed'));
            console.log(`\n  Error: ${error.message}`);
        }
    });

// Demo command
program
    .command('demo')
    .description('Generate a demo store with sample data')
    .option('-o, --output <dir>', 'Output directory', './demo-store')
    .option('-n, --name <name>', 'Store name', 'Demo Store')
    .action(async (options) => {
        console.log(banner);

        const config = {
            outputDir: path.resolve(options.output),
            siteName: options.name,
            siteDescription: 'A blazing fast HTML5 demo store',
            optimizeImages: true,
            enablePWA: true
        };

        await runConversion(config);
    });

// Serve command
program
    .command('serve [dir]')
    .description('Serve the generated store locally')
    .option('-p, --port <port>', 'Port number', '3000')
    .action(async (dir, options) => {
        const serveDir = dir || './output';

        if (!await fs.pathExists(serveDir)) {
            console.log(chalk.red(`Error: Directory ${serveDir} does not exist`));
            console.log('Run "woo-convert convert" or "woo-convert demo" first');
            process.exit(1);
        }

        console.log(banner);
        console.log(chalk.cyan(`Starting server for ${serveDir}...`));
        console.log(chalk.green(`\nServer running at http://localhost:${options.port}`));
        console.log(chalk.gray('Press Ctrl+C to stop\n'));

        // Use a simple HTTP server
        const http = require('http');
        const finalHandler = require('finalhandler');
        const serveStatic = require('serve-static');

        try {
            const serve = serveStatic(serveDir, { index: ['index.html'] });
            const server = http.createServer((req, res) => {
                serve(req, res, finalHandler(req, res));
            });

            server.listen(options.port);
        } catch (error) {
            console.log(chalk.yellow('serve-static not installed. Install it with:'));
            console.log(chalk.cyan('npm install serve-static finalhandler'));
            console.log(chalk.yellow('\nAlternatively, use: npx serve ' + serveDir));
        }
    });

// Initialize config file
program
    .command('init')
    .description('Create a configuration file')
    .action(async () => {
        console.log(banner);

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'siteName',
                message: 'Store name:',
                default: 'My Store'
            },
            {
                type: 'input',
                name: 'siteUrl',
                message: 'WooCommerce site URL (optional):'
            },
            {
                type: 'input',
                name: 'outputDir',
                message: 'Output directory:',
                default: './output'
            },
            {
                type: 'input',
                name: 'primaryColor',
                message: 'Primary color (hex):',
                default: '#2563eb'
            }
        ]);

        const config = {
            siteName: answers.siteName,
            siteDescription: `Welcome to ${answers.siteName}`,
            siteUrl: answers.siteUrl || null,
            outputDir: answers.outputDir,
            primaryColor: answers.primaryColor,
            currency: 'USD',
            currencySymbol: '$',
            productsPerPage: 12,
            enableSearch: true,
            enableCart: true,
            enableWishlist: false,
            enablePWA: true,
            optimizeImages: true,
            generateWebp: true
        };

        const configPath = path.join(process.cwd(), 'woo-config.json');
        await fs.writeJson(configPath, config, { spaces: 2 });

        console.log(chalk.green(`\nConfiguration saved to ${configPath}`));
        console.log('\nNext steps:');
        console.log('  1. Edit woo-config.json to add your WooCommerce credentials');
        console.log('  2. Run: woo-convert convert');

        // Create .env template
        const envTemplate = `# WooCommerce API Credentials
WOO_SITE_URL=https://your-store.com
WOO_CONSUMER_KEY=ck_your_consumer_key
WOO_CONSUMER_SECRET=cs_your_consumer_secret
`;
        const envPath = path.join(process.cwd(), '.env.example');
        await fs.writeFile(envPath, envTemplate);
        console.log(chalk.gray(`\nCredentials template saved to ${envPath}`));
    });

// Interactive setup
async function runInteractiveSetup() {
    console.log(chalk.cyan('\nInteractive Setup\n'));

    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'hasWooCommerce',
            message: 'Do you have a WooCommerce store to connect to?',
            default: false
        },
        {
            type: 'input',
            name: 'siteUrl',
            message: 'WooCommerce site URL:',
            when: (ans) => ans.hasWooCommerce,
            validate: (input) => {
                try {
                    new URL(input);
                    return true;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        },
        {
            type: 'input',
            name: 'consumerKey',
            message: 'Consumer Key:',
            when: (ans) => ans.hasWooCommerce
        },
        {
            type: 'password',
            name: 'consumerSecret',
            message: 'Consumer Secret:',
            when: (ans) => ans.hasWooCommerce
        },
        {
            type: 'input',
            name: 'siteName',
            message: 'Store name:',
            default: 'My Store'
        },
        {
            type: 'input',
            name: 'siteDescription',
            message: 'Store description:',
            default: (ans) => `Welcome to ${ans.siteName}`
        },
        {
            type: 'input',
            name: 'outputDir',
            message: 'Output directory:',
            default: './output'
        },
        {
            type: 'input',
            name: 'primaryColor',
            message: 'Primary color (hex):',
            default: '#2563eb'
        },
        {
            type: 'list',
            name: 'currency',
            message: 'Currency:',
            choices: [
                { name: 'USD ($)', value: 'USD' },
                { name: 'EUR (€)', value: 'EUR' },
                { name: 'GBP (£)', value: 'GBP' },
                { name: 'CAD ($)', value: 'CAD' },
                { name: 'AUD ($)', value: 'AUD' }
            ],
            default: 'USD'
        },
        {
            type: 'checkbox',
            name: 'features',
            message: 'Features to enable:',
            choices: [
                { name: 'Search', value: 'search', checked: true },
                { name: 'Shopping Cart', value: 'cart', checked: true },
                { name: 'Wishlist', value: 'wishlist', checked: false },
                { name: 'PWA (Offline Support)', value: 'pwa', checked: true },
                { name: 'Image Optimization', value: 'images', checked: true },
                { name: 'WebP Generation', value: 'webp', checked: true }
            ]
        }
    ]);

    const currencySymbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        CAD: '$',
        AUD: '$'
    };

    return {
        siteUrl: answers.siteUrl || null,
        consumerKey: answers.consumerKey || null,
        consumerSecret: answers.consumerSecret || null,
        siteName: answers.siteName,
        siteDescription: answers.siteDescription,
        outputDir: path.resolve(answers.outputDir),
        primaryColor: answers.primaryColor,
        currency: answers.currency,
        currencySymbol: currencySymbols[answers.currency],
        enableSearch: answers.features.includes('search'),
        enableCart: answers.features.includes('cart'),
        enableWishlist: answers.features.includes('wishlist'),
        enablePWA: answers.features.includes('pwa'),
        optimizeImages: answers.features.includes('images'),
        generateWebp: answers.features.includes('webp')
    };
}

// Run conversion
async function runConversion(config) {
    console.log(chalk.cyan('\nStarting conversion...\n'));

    const spinner = ora('Initializing...').start();

    try {
        const builder = new StoreBuilder(config);

        const stats = await builder.build((message) => {
            spinner.text = message;
        });

        spinner.succeed(chalk.green('Conversion complete!'));

        // Print stats
        console.log('\n' + chalk.bold('Build Statistics:'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`  ${chalk.cyan('Duration:')}     ${stats.duration}`);
        console.log(`  ${chalk.cyan('Pages:')}        ${stats.pagesGenerated}`);
        console.log(`  ${chalk.cyan('Images:')}       ${stats.imagesOptimized}`);
        console.log(`  ${chalk.cyan('Total Size:')}   ${stats.totalSize}`);
        console.log(`  ${chalk.cyan('Output:')}       ${stats.outputDir}`);
        console.log(chalk.gray('─'.repeat(40)));

        console.log('\n' + chalk.green('Your HTML5 store is ready!'));
        console.log('\nTo preview your store:');
        console.log(chalk.cyan(`  npx serve ${path.relative(process.cwd(), stats.outputDir)}`));
        console.log('\nOr:');
        console.log(chalk.cyan(`  woo-convert serve ${path.relative(process.cwd(), stats.outputDir)}`));

    } catch (error) {
        spinner.fail(chalk.red('Conversion failed'));
        console.error('\n' + chalk.red('Error:'), error.message);

        if (error.message.includes('ENOENT')) {
            console.log(chalk.yellow('\nTip: Make sure the templates directory exists'));
        }

        if (error.message.includes('connection')) {
            console.log(chalk.yellow('\nTip: Check your WooCommerce credentials and site URL'));
        }

        process.exit(1);
    }
}

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
    console.log(banner);
    program.outputHelp();
}
