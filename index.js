const chalk = require("chalk");
const express = require("express");
const bodyParser = require('body-parser')
const {
  WAConnection,
  ReconnectMode
} = require("@adiwajshing/baileys")
const fs = require("fs");
const multer = require('multer');
const csv = require('csv-parser');
const makeCsv = require('csv-writer');
var ProgressBar = require('progress');
const { redirect } = require("express/lib/response");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Set the destination where the files should be stored on disk
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {

    cb(null,  file.originalname);
  },
  fileFilter: function (req, file, cb) {

    if (file.mimetype !== "text/yaml" || file.mimetype !== "text/x-yaml" || file.mimetype !== "application/x-yaml") {
      // To reject a file pass `false` or pass an error
      cb(new Error(`Forbidden file type`));
    } else {
      // To accept the file pass `true`
      cb(null, true);
    }

  }
});

// Setup multer
const upload = multer({
  storage: storage
}); // { destination: "uploads/"}



class App {
  app;

  constructor() {
    this.app = express();
    this.app.set("host", "0.0.0.0");
    this.app.set("port", process.env.PORT || 4000);
    this.app.set('view engine', 'ejs');
    this.app.use(express.static("./newFile"))
    this.app.use(express.static('public'));
    this.app.use(bodyParser.json())
    this.app.use(bodyParser.urlencoded({
      extended: true
    }))

    this.client = new WAConnection()
    this.client.autoReconnect = ReconnectMode.onAllErrors
    this.client.connectOptions.maxRetries = Infinity
    this.client.connectOptions.timeoutMs = 30 * 1000
  }

  async listen() {
    const authFile = '.auth_info.json'
    if (fs.existsSync(authFile)) {
      try {
        this.client.loadAuthInfo(authFile)
        await this.client.connect()
      } catch (err) {
        console.error(err)
      }
    } else {
      await this.client.connect()
      const authInfo = this.client.base64EncodedAuthInfo() // get all the auth info we need to restore this session
      fs.writeFileSync(authFile, JSON.stringify(authInfo, null, '\t')) // save this info to a file
    }

    console.log(`${chalk.green("✓")} Whatsapp Connection is Open`)
    console.log(`${chalk.green("✓")} Ready - using account of: ${this.client.user.name}`)




    this.app.post("/uploadFile", upload.single("myFile"), (req, res) => {
     var clite= this.client;
     var data = [];
     var fileNamedate = Date.now();

     try {
        var file = fs.readdirSync("./uploads", {
          withFileTypes: true
        })
        file.forEach((e) => {
          if (e.name === req.file.originalname) {
            fs.createReadStream(__dirname + "/uploads/" + e.name)
              .pipe(csv())
              .on('data', async function (row) {
                await Promise.all(
                  Object.keys(row).map(async (v, k) => new Promise((resolve, reject) => {
                    if (!isNaN(row[v] || row[v] !== '')) {
                      setTimeout(async () => {
                        const contactId = row[v].includes('@s.whatsapp.net') ? row[v].trim() : row[v].trim() + '@s.whatsapp.net'
                        const result = await clite.isOnWhatsApp(contactId)
                        if (result == undefined) {
                          console.log("Google");
                          data.push({
                            number: row[v],
                            exits: false
                          })
                        } else {
                          console.log("Success", result, row[v]);
                          data.push({
                            number: row[v],
                            exits: result.exists
                          })
                        }
                        resolve()
                      }, k * 100)
                    }
                  })));
                if (data.length > 0) {
                  // console.log(data)
                  
                    const file = makeCsv.createObjectCsvWriter({
                      path: __dirname + "/newFile/" + fileNamedate + "WhatsAppVerifier.csv",
                      header: [{
                          id: "number",
                          title: 'Number'
                        },
                        {
                          id: "exits",
                          title: 'Exits'
                        }
                      ]
                    })
                   
                    file
                      .writeRecords(data)
                      .then(() => {
                   
                  });
                 
                }
                console.log("END OF THE DATE")
                //  res.download(__dirname + "/newFile/" + fileNamedate + "WhatsAppVerifier.csv")
              })
              .on('end', function () {
                console.table("users")
                //  res.download(__dirname + "/newFile/" + fileNamedate + "WhatsAppVerifier.csv")
              })
          }
          
        })
        // res.redirect('/')
         res.render("index.ejs", {
           result: [{
             number:"923111312164",
             value: 
             fileNamedate + "WhatsAppVerifier.csv",
           }]
         })
     } catch (error) {
         return res.render("index.ejs", {
           error: 'nomernya ada yang salah tu'
         })
    }
    })






    this.app.get("/", (req, res) => {
      res.render('index.ejs')
    });
    this.app.post("/", async (req, res) => {
      const numberRaw = req.body.number
      const numberlist = numberRaw.replace(/\r/g, " ").replace(/\//g, "").replace(/\n/g, "").split(" ")
      console.log(`[${chalk.yellow('Work')}] Checking ${numberlist.length} number...`)
     
      if (numberlist.length >= 2001) {
        return res.render("index.ejs", {
          error: 'asu nomernya kebanyakan, maksimal 200 cok'
        })
      } else if (numberlist.length <= 1 && numberlist[0] == '') {
        return res.render("index.ejs", {
          error: 'Cok gada nomernya, masukin dulu lah'
        })
      }

      let validNumber = []
      await Promise.all(
        numberlist.map((number, i) => new Promise((resolve, reject) => {
          if (!isNaN(number) || number == '') {
            setTimeout(async () => {
              const contactId = number.includes('@s.whatsapp.net') ? number.trim() : number.trim() + '@s.whatsapp.net'
              const result = await this.client.isOnWhatsApp(contactId)
              result ? console.log(`[${chalk.green(i)}] Number:`, number, '| Result:', result) : console.log(`[${chalk.red(i)}] Number:`, number, '| Result:', result)
              console.log(result)
              if (result == undefined) {
                console.log("Google");
                validNumber.push({
                  number,
                  value: ", Failed"
                })
              } else {
                // console.log("Success");
                validNumber.push({
                  number,
                  value: ", Pass"
                })
                // validNumber.push({number, value: result.toUpperCase()})
              }
              resolve()
            }, i * 100)
          } else {
            return res.render("index.ejs", {
              error: 'nomernya ada yang salah tu'
            })
          }
        })))
      res.render("index.ejs", {
        result: validNumber
      })
    })

    this.app.listen(this.app.get("port"), () => {
      console.log(`${chalk.green("✓")} server started at http://localhost:${this.app.get("port")}`);
    });


    
  }
  
}







const server = new App();
server.listen();