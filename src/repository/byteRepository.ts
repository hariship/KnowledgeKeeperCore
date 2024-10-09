import { Repository } from "typeorm";
import { Byte } from "../entities/byte";
import { AppDataSource } from "../db/data_source";
import { UserDetails } from "../entities/user_details";
import axios from 'axios';  
import { UserRepository } from "./userRepository";
import { Recommendation } from "../entities/recommendation";
import { Equal } from 'typeorm';

export class ByteRepository {
    private byteRepo: Repository<Byte>;
    private recommendationRepo: Repository<Recommendation>;

    constructor() {
        this.recommendationRepo = AppDataSource.getRepository(Recommendation);
        this.byteRepo = AppDataSource.getRepository(Byte);  // Get the Document repository from the AppDataSource
    }

    async findAllOpenWithHighRecommendations(clientId:any) {
        // This method should fetch all bytes marked as 'open' with a high recommendationCount.
        // Implement the query based on your database schema.
        return this.byteRepo.find({
            where: {
                status: 'open',
                clientId
            },
            relations: ['clientId']
        });
    }

    async findByteWithDocById(id: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
            where: { id },
            relations: ['requestedBy', 'clientId','docId'],
        });
    }

        // Fetch all bytes with 'closed' status and high resolved recommendation count
    async findAllClosedWithHighResolvedRecommendations(clientId:any) {
        return this.byteRepo.find({
            where: {
                status: 'closed',
                clientId
            },
            relations: ['docId']
        });
    }

    // Find a byte by its ID
    async findByteById(byteId: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
            where: { id: byteId },
            relations: ['docId']
        });
    }

    async findByteByClientAndDocument(byteId: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
          where: {
            id: byteId
          },
          relations: ['requestedBy', 'docId'],
        });
      }

    // Find a byte by its ID
    async createByte(byteInfo: any, user: UserDetails, clientId:any): Promise<Byte | null> {
        const newByte = await this.byteRepo.create({
            byteInfo,
            requestedBy: user,
            noOfRecommendations: 0,
            isProcessedByRecommendation: false,
            status: 'open',
            clientId
          });
          let byteSaved = await this.byteRepo.save(newByte);
          let recommendationResponse = await this.callExternalRecommendationService(byteSaved);
          if (recommendationResponse.data){
            let recommendationData = recommendationResponse.data?.data
            for(let recommendationContent of recommendationData){
              const newRecommendation = await this.recommendationRepo.create({
                byte: byteSaved,
                recommendation: recommendationContent,
                // document: "Door Dash Test 1",
                recommendationAction: recommendationContent?.metadata?.updation_type
              });
              await this.recommendationRepo.save(newRecommendation);
            }
          }
          byteSaved.noOfRecommendations = recommendationResponse?.data?.data.length
          await this.byteRepo.save(byteSaved)
          return byteSaved;
    }   

    async deleteByte(byteId:any): Promise<Byte | null> {
        const byte = await this.byteRepo.findOne({ where: { id: byteId } });
        if (!byte) throw new Error('Byte not found');
        await this.recommendationRepo.createQueryBuilder()
        .delete()
        .from(Recommendation)
        .where("byte IN (:...byteId)", { byteId: byteId })
        .execute();
        await this.byteRepo.remove(byte);
        return byte;
    }

    async callExternalRecommendationService(byte: Partial<Byte>){
        let response = await axios.post(
            `http://3.142.50.84:5000/v1/predict`,
            { 
              input_text: byte?.byteInfo,
              data_id: "Door Dash Test 1"
            },
            {
              headers: {
                'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499',
                'Content-Type': 'application/json'
              }
            }
          );
          return response;
    }

    async getRecommendations(byte: Partial<Byte>) {
        try {
          let recommendationsForByte = await this.recommendationRepo.find({
            where:{
              byte: {
                id: byte?.id
              }
            }
          })
          
          console.log('recommendationsForByte',recommendationsForByte)
          const docHTML = '<!DOCTYPE html><html lang="en"><head>    <meta charset="UTF-8">    <meta name="viewport" content="width=device-width, initial-scale=1.0">    <title>Doordash Document</title>    <style>        body {            font-family: Arial, sans-serif;        }        h1, h2, h3 {            color: #333;        }        ul {            list-style-type: disc;            padding-left: 20px;        }        p {            margin: 10px 0;        }        img {            display: block;            margin: 20px auto;            max-width: 100%;        }    </style></head><body><h1>Manage Your Account</h1><h2>How are Taxes Calculated?</h2><p>Taxes apply to orders based on local regulations. The amount of tax charged depends on many factors including the following:</p><ul>    <li>The type of item purchased</li>    <li>The time and date of the purchase</li>    <li>The location of the store and your delivery address</li>    <li>The date and method of fulfillment</li></ul><p>These factors can change between the time you place an order and when your order is complete. We sometimes rely on our merchants to calculate the exact tax amount applicable. We display an estimated tax at checkout which may be updated later when your order is completed. Finalized tax will be shown on your order receipt.</p><h2>Verifying my Account</h2><h3>Why do I need to verify my phone number?</h3><p>DoorDash requires users to verify their phone number to improve the experience on the app. When Dashers deliver items to the user, the Dasher may need to communicate with the user using SMS. Please note that in order to verify the Phone number, the code can only be requested on the phone number and not email address.</p><h3>How do I verify my phone number?</h3><p>When prompted on our platform, you will enter a 6 digit code that is sent to the phone number you added during the sign-up process. (You can update your phone number at any time in your profile). You must ensure that you are using a phone that is able to receive SMS (text messages).</p><h3>What do I do if I am not receiving the code?</h3><ul>    <li>Ensure that the phone number on your account is one that can receive SMS</li>    <li>Check that your Wifi or network connection is working correctly</li>    <li>If you have unsubscribed from receiving text messages from DoorDash you can either choose to resend the code to your email address or opt into notifications from DoorDash by following the instructions here.</li>    <li>Try to resend the code by tapping on ‘Resend Code’</li>    <li>If you are still having trouble verifying, you may choose to call support using the phone with the phone number associated with your account that you are trying to verify.</li></ul><h2>Multi-Factor Authentication</h2><p>To increase security on your account, we may periodically ask you to verify that you own the account. A part of the verification process is to receive a 6 digit code from DoorDash via Email or Text message to your phone. Once you have received the 6 digit code, follow the prompts in your account to enter the code and verify your identity.</p><h3>Why am I not receiving an email?</h3><p>Please check your spam, trash, and junk folders. Additionally, allow up to 2 minutes to receive the email before requesting the code to be resent or to send the code via text message instead.</p><h3>How many attempts do I get?</h3><p>You have 5 attempts before you are locked out of your account.</p><h3>What can I do if I am locked out of my account?</h3><p>After 5 failed attempts, you must wait 30 minutes until you can try again.</p><h3>Why was there an error sending me the code?</h3><p>If you encounter an error while sending the code, try to resend the code to the other option (For example, if you chose SMS as the option, try the Email option). You can also close the app and try again.</p><h3>Does the code expire?</h3><p>Yes, the code generated and sent to you expires after 30 minutes. If you are not able to use it before then, you will need to send yourself a new code.</p><h3>I received a "Sign-in attempt from a new device" email from DoorDash but I didnt sign in on a new device. What should I do?</h3><p>Legitimate Doordash notifications will come from a valid @doordash.com or @trycaviar.com email address (example - “no-reply@doordash.com” or “support@trycaviar.com"). If you believe you received this notification but didn’t try to sign into Doordash on a new device you should access your account and change your password immediately. We also recommend confirming that the phone number within your Doordash account is up to date. If you’re concerned about the security of your account or if you see any unauthorized transactions Contact Support right away.</p><h2>Where can I use my SNAP benefits on DoorDash?</h2><p>SNAP/EBT benefits can be used on DoorDash purchases at select 7-Eleven locations, Acme, Albertsons, ALDI, Andronico’s, Balducci’s, Bel Air Mart, Carrs, DashMart, Duane Reade, Food City, Food Lion, Giant Food, Giant Heirloom, Haggen, Hannaford, Hy-Vee, Jewel-Osco, Kings, Meijer, MARTINS, Nob Hill, Pavilions, Raley’s, Randall’s, Safeway, Save Mart, Shaw’s, Smart & Final, Stater Brothers, Star Markets, Stop & Shop, Sprouts, The Giant Company, Tom Thumb, Vons, and Walgreens. For a full list of SNAP-eligible stores near a specific address, visit <a href="https://www.doordash.com/p/snap-ebt">https://www.doordash.com/p/snap-ebt</a>.</p><h3>How do I use my SNAP benefits on DoorDash?</h3><ol>    <li>Add a SNAP/EBT card: Go to Account > Payment > Program Cards to add a SNAP card. Click or tap “SNAP/EBT Card” and enter the EBT card number. Alternatively, EBT cards can be added to an account at checkout by changing or adding to your payment method.</li>    <li>Find SNAP-eligible stores: From the home screen, select the convenience or grocery icons. Use the SNAP filter at the top of the screen to filter by stores accepting SNAP.</li>    <li>Shop for SNAP-eligible items: On the SNAP-eligible store’s page, browse SNAP-eligible items within a specific category by choosing the category and selecting the SNAP filter at the top of the page. To check SNAP-eligibility for a specific item, select the item and look for the SNAP icon on the item info screen.</li>    <li>Apply SNAP to an order: At checkout, the SNAP-eligible subtotal will automatically be applied to the order. Customers can adjust the SNAP amount applied to the order by selecting “Apply SNAP Amount” and editing the amount. Please note: if nothing is entered into the SNAP applied amount, any remaining subtotal, applicable taxes, and fees must be paid with an alternate payment method such as a debit card, credit card, or DoorDash Credits.</li></ol><h2>Frequently Asked Questions</h2><h3>What is a SNAP/EBT card?</h3><p>Electronic Benefits Transfer (EBT) is an electronic system that allows a Supplemental Nutrition Assistance Program (SNAP) participant to pay for certain eligible items using SNAP benefits. Similar to a credit or debit card, SNAP/EBT cards can be added as a saved payment method on DoorDash and used when shopping for eligible food items.</p><h3>How do I use my SNAP benefits on DoorDash?</h3><p>Get started by adding your SNAP/EBT card as a saved payment method under your Account Settings. When shopping, look for stores and items with a SNAP label and add eligible items to your cart. At checkout, the SNAP-eligible amount will automatically apply to the order subtotal. Customers can adjust the amount of SNAP benefits applied to their order by selecting “Apply SNAP Amount” and entering the amount they would like applied to their order. If the amount is left blank or set to $0, SNAP will not be charged even if the PIN is entered at checkout.</p><h3>What items can be purchased on DoorDash with a SNAP/EBT card?</h3><p>Item eligibility is determined by the United States Department of Agriculture (USDA) and follows the same guidelines as found in-store. A list of these eligible food categories can be found on the USDA website. Customers can find SNAP-eligible items on DoorDash using the SNAP filter at the top of each eligible store’s page or by looking for the SNAP icon on each item’s info page.</p><h3>Which stores accept SNAP/EBT on DoorDash?</h3><p>To identify participating merchants in your area, visit <a href="https://www.doordash.com/p/snap-ebt">https://www.doordash.com/p/snap-ebt</a> or navigate to the grocery or convenience tabs to use the SNAP filter to identify eligible stores.</p><h3>Can I purchase SNAP-eligible and non-SNAP-eligible items at the same time?</h3><p>Yes, at checkout you can use your SNAP/EBT card to pay for eligible food items and purchase all other items in your cart with an alternative payment method such as a credit card, debit card, or gift card.</p><h3>Can I use a promotion code on a SNAP/EBT order?</h3><p>Yes, promotion codes are eligible on orders where a SNAP/EBT card is applied. Simply enter your promo code at checkout.</p><h3>What if an item I purchased with EBT card is missing or incorrect?</h3><p>If a refund needs to be issued for an item you purchased with your SNAP/EBT card, the funds will be returned to your SNAP/EBT card. Refunds for items not purchased with your SNAP/EBT card will be returned through your original payment method or DoorDash credits.</p><h3>What if an item in my order is out of stock or substituted?</h3><p>Refunds for out-of-stock items will be issued back to the original payment method. If an item in your order is substituted for an item of equal value, there will be no additional charge to your EBT card or backup payment method. If an item in your order is substituted for a more expensive item, the backup payment method on the account (debit/credit card) will be charged the difference between the original item and the substituted item.</p><h3>Can I use my SNAP benefits with DoubleDash?</h3><p>No, currently SNAP is not available with our DoubleDash feature.</p><h3>Does DoorDash charge tax on SNAP purchases?</h3><p>DoorDash does not charge tax on any portion of an order that was paid for with a SNAP/EBT card. Any portion of an order paid with a debit card, credit card, or DoorDash credits is subject to applicable local tax. In some locations, DoorDash may charge taxes on fees (e.g. service fee, delivery fee) depending on applicable laws.</p><h2>Notifications From DoorDash and Texts From Your Dasher</h2><h3>How do I opt into notifications from DoorDash and Dashers?</h3><p>Follow these two steps to ensure your account is receiving notifications from DoorDash and text messages from Dashers. We recommend having SMS and Push Notifications turned on in order to receive updates about your delivery:</p><h4>DoorDash Mobile App Users:</h4><ol>    <li>Tap on the Account icon at the top of the app.</li>    <li>Scroll down to Notifications.</li>    <li>Select the notification type.</li>    <li>Use the slide bar to turn notifications on.</li></ol><h4>iOS</h4><p>Instructions for iOS users.</p><h4>Android</h4><p>Instructions for Android users.</p><h3>How do I opt out of notifications from DoorDash?</h3><p>We highly recommend keeping the Order Updates Push and Order Updates SMS options on, as these are used:</p><ul>    <li>To notify you of the status of your order</li>    <li>To alert you when your Dasher is having trouble finding you</li></ul><p>However, regardless of your opt-in status for Order Updates Push and Order Updates SMS, your Dasher will be able to send a message to you directly about your order and reply to any messages you may have sent (including details on a no-contact drop-off).</p><h3>How do I change my delivery address?</h3><p>If you do not have an active delivery in process, you can change your delivery address through the DoorDash website or mobile app:</p><h4>FOR WEBSITE USERS:</h4><ol>    <li>First, click on the existing address in the upper right-hand corner of the website.</li>    <li>To select a different delivery address, click on the address from the list of addresses provided. This will become your default address.</li>    <li>To add a new address, enter the address in the search bar and select the address from the populated results.</li>    <li>If applicable, add in the apartment number or suite and any delivery instructions.</li>    <li>Click Save. This will become your default delivery address.</li>    <li>To delete an address, click on the X located on the right-hand side of the address. You cannot delete a default address; please first select a different default address before deleting.</li>    <li>To edit an existing address and/or the delivery instructions, delete the address and then follow the add a new address steps.</li></ol><h4>FOR MOBILE APP USERS:</h4><h4>IOS</h4><ol>    <li>Tap on the Account icon at the top.</li>    <li>Tap on Addresses.</li>    <li>To select a different delivery address, click on the address from the list of addresses provided. This will now become your new default address.</li>    <li>To add an address, enter the address in the search bar and select the address from the populated results.</li>    <li>If applicable, add in the apartment number or suite and any delivery instructions.</li>    <li>Click Save Address. This will now become your new default address.</li>    <li>To delete an address, tap on the pencil icon that address and then tap on the trash icon in the upper right corner to delete.</li></ol><p>Note: You won’t be able to delete a default address. Please first select a different default address.</p><h4>ANDROID</h4><ol>    <li>Tap on the Account tab.</li>    <li>Tap on Addresses.</li>    <li>To select a different delivery address, click on the address from the list of addresses provided. This will now become your new default address.</li>    <li>To add an address, enter the address in "search" for the new address and select the address from the populated results.</li>    <li>If applicable, add in the apartment number or suite and any delivery instructions.</li>    <li>Click Save. This will now become your new default address.</li>    <li>To delete an address, tap on the pencil icon for the address and then tap on the trash icon in the upper right corner to delete.</li></ol><h3>How do I update my credit card information?</h3><p>You can update your credit card information any time in your DoorDash account. If you would like to replace an existing card, you are required to first add a new card before removing the existing card. The last credit card used will remain the default credit card when placing your order.</p><h4>Mobile app users</h4><h5>iOS</h5><ol>    <li>Open your DoorDash app.</li>    <li>Tap the "Account" icon at the top.</li>    <li>Tap on "Payment" under "Account Settings".</li>    <li>Under "Add Payment Method", click the arrow next to Credit/Debit Card.</li>    <li>Enter the card number, CVC code, expiration date, and billing zip code.</li>    <li>Tap "Save".</li>    <li>If more than one card is on the account, click the card you would like to set as the default card. A checkmark will appear next to the card that is set as the default.</li></ol><h5>ANDROID</h5><ol>    <li>Open your DoorDash app.</li>    <li>Tap the icon located in the top left corner.</li>    <li>Tap on "Payment Methods".</li>    <li>Under "Add Payment Method", click the arrow next to Credit/Debit Card.</li>    <li>Enter the card number, CVC code, expiration date, and billing zip code.</li>    <li>Tap "Add Card".</li>    <li>If more than one card is on the account, click the card you would like to set as the default card. A checkmark will appear next to the card that is set as the default.</li></ol><h4>Desktop users</h4><ol>    <li>Login to your account on the DoorDash website.</li>    <li>Click on Account in the bottom left corner.</li>    <li>Click on “Payment”.</li>    <li>Under "Add New Payment Method", click the arrow next to Credit/Debit Card.</li>    <li>Enter the card number, CVC code, expiration date, and billing zip code.</li>    <li>Click Add Card to save the information.</li>    <li>If more than one card is on the account, click the card you would like to set as the default card. A checkmark will appear next to the card that is set as the default.</li></ol><h3>How do I update my account information?</h3><p>You can change personal information anytime in your account. To keep your account information secure, you will be required to validate your account ownership through a 2-Factor Authentication process.</p><p>You can make the following changes to your DoorDash account profile in the app or on the DoorDash website:</p><ul>    <li>First Name</li>    <li>Last Name</li>    <li>Phone Number</li>    <li>Email Address</li>    <li>Country (Web only)</li>    <li>Password (will require you to enter your new password again and the old password)</li></ul><h4>Mobile app users</h4><ol>    <li>Open your DoorDash app.</li>    <li>Tap the account icon at the top left of the screen.</li>    <li>Tap “Profile”.</li>    <li>Tap on the field you would like to update.</li>    <li>Tap the “check mark” in the upper right corner.</li>    <li>Verify your information through 2-Factor Authentication. On-screen instructions will guide you through the process.</li></ol><h4>Desktop users</h4><ol>    <li>Log in to your account on the DoorDash website.</li>    <li>Open the menu in the upper left corner.</li>    <li>Select “Account”.</li>    <li>Edit the fields you would like to update.</li>    <li>Select “Save”.</li>    <li>Verify your information through 2-Factor Authentication. On-screen instructions will guide you through the process.</li></ol><h3>How do I verify my account?</h3><p>Verifying my phone number during account creation:</p><p>A part of creating a DoorDash account is verifying the phone number you entered. To verify, you will need to enter the 6 digit code that is sent to the phone number you added once prompted during the sign up process.</p><h3>What if I do not receive a SMS code during account creation?</h3><p>Please follow the troubleshooting steps below if you are not receiving the verification code via text message:</p><ul>    <li>Check that your Wifi or network connection is working correctly.</li>    <li>Ensure the phone number you entered is correct and is able to receive SMS codes (landlines do not work here).</li>    <li>Tap Resend Code at the bottom of the app screen after 1 minute to receive a new text message.</li>    <li>If you have been blocked by the 2-Step Verification interface after too many code entry attempts, please wait 30 minutes for the systems to unblock you and try again.</li>    <li>Check with your service provider.</li>    <li>Contact support here if you are still not able to receive the SMS code.</li></ul><h2>Images</h2><img src="image1.png" alt="Image description 1"><img src="image2.png" alt="Image description 2"><img src="image3.png" alt="Image description 3"></body></html>'
          // let response = await axios.post(
          //   `http://3.142.50.84:5000/v1/predict`,
          //   { 
          //     input_text: byte?.byteInfo,
          //     data_id: "Door Dash Test 1"
          //   },
          //   {
          //     headers: {
          //       'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499',
          //       'Content-Type': 'application/json'
          //     }
          //   }
          // );
          // response = response.data

          const response:any = {
            request_id: byte.id,
            request_text:
              byte.byteInfo,
            sender: byte?.requestedBy,
            date_time: byte?.createdAt,
            documents: [
              {
                doc_id: "Door Dash Test 1",
                doc_content: docHTML
                  ,
                recommendations:[]
              }
            ]
          }
          const recommendations = []
          if(recommendationsForByte){
            for(let recommendationByte of recommendationsForByte){
              const recommendationJson = JSON.parse(recommendationByte?.recommendation)
              recommendations.push({
                id: recommendationByte.id,
                change_request_type: (recommendationByte?.recommendationAction == 'new_section' || recommendationByte?.recommendationAction == 'add')  ? 'Add' : 'Replace',
                change_request_text: recommendationJson?.generated_text,
                    previous_string: recommendationJson?.sectionContent,
              })
            }
          }

          response.documents[0].recommendations.push(recommendations)

          return response;
        } catch (error) {
          console.error('Error fetching recommendations:', error);
          throw new Error('Failed to fetch recommendations');
        }
      }
}