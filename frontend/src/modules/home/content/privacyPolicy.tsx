import type { ReactNode } from "react";

/**
 * The privacy policy's wording, in one place. PrivacyPage only lays it out.
 * The Google Play listing links here, and its account-deletion URL is
 * proctavo.com/privacy#delete-account. Keep that section id, and keep the
 * publisher name matching the Play developer name.
 */

export const PRIVACY_PUBLISHER = "Earthling Aid Tech";
export const PRIVACY_CONTACT = "services@earthlingaidtech.com";
export const PRIVACY_UPDATED = "31 October 2026";

export interface PolicySection {
  /** Stable anchor: proctavo.com/privacy#<id>. */
  id: string;
  heading: string;
  paragraphs: ReactNode[];
  points?: ReactNode[];
}

const Mail = () => (
  <a href={`mailto:${PRIVACY_CONTACT}`} className="font-medium text-indigo-600 hover:text-indigo-700">
    {PRIVACY_CONTACT}
  </a>
);

export const PRIVACY_INTRO: ReactNode = (
  <>
    Proctavo is an exam-duty planner that colleges use to organise invigilation. It's developed and run by{" "}
    {PRIVACY_PUBLISHER} ("we"). This policy covers the Proctavo website (proctavo.com) and the Proctavo mobile app:
    what they collect, why, who sees it, and how to have it deleted.
  </>
);

export const PRIVACY_SECTIONS: PolicySection[] = [
  {
    id: "who-decides",
    heading: "Your college decides who has an account",
    paragraphs: [
      <>
        Nobody signs up for Proctavo. Accounts are created by your college's exam cell (the Controller of
        Superintendents, "CS"), who also enter the exams, rooms and duties. We run the service for your college. For
        questions about data your college entered, ask your exam cell or write to us.
      </>,
    ],
  },
  {
    id: "what-we-collect",
    heading: "What we collect",
    paragraphs: [],
    points: [
      <>
        <b>Account details your college enters:</b> name, email address, phone number, department, designation and the
        exam roles that follow from it.
      </>,
      <>
        <b>Your password</b>, stored only as a one-way hash. Password-reset codes are hashed too and expire after 10
        minutes.
      </>,
      <>
        <b>Exam-duty records:</b> the duties you're assigned or pick, your confirmations, change and swap requests, and
        the notifications sent about them.
      </>,
      <>
        <b>Messages</b> you exchange with your exam cell inside Proctavo.
      </>,
      <>
        <b>Activity:</b> when you were last active, and an audit trail of administrative changes that your exam cell can
        see.
      </>,
      <>
        <b>From the mobile app:</b> a push-notification token, your phone's platform (Android or iPhone) and the app
        version, so alerts reach your phone.
      </>,
      <>
        <b>Server logs:</b> like most websites, our servers record IP addresses and request details for security and
        troubleshooting.
      </>,
    ],
  },
  {
    id: "what-we-dont",
    heading: "What we don't collect",
    paragraphs: [
      <>
        Proctavo doesn't access your location, contacts, photos, camera, microphone or files. It has no advertising,
        no ad identifiers and no third-party analytics or tracking. We never sell personal data.
      </>,
    ],
  },
  {
    id: "how-we-use",
    heading: "How we use it",
    paragraphs: [
      <>
        Only to run Proctavo for your college: working out fair duty targets, showing and assigning duties, handling
        swaps, sending email reminders and calendar invites, push notifications and on-phone alarms, letting you
        message your exam cell, and keeping the service secure.
      </>,
    ],
  },
  {
    id: "on-your-phone",
    heading: "On your phone",
    paragraphs: [
      <>
        The app keeps your sign-in in the phone's secure storage and schedules duty alarms on the phone itself, from
        your upcoming duties. It asks for these permissions, and you can change them in your phone's settings:
      </>,
    ],
    points: [
      <>
        <b>Notifications:</b> alerts about your duties and messages.
      </>,
      <>
        <b>Alarms &amp; reminders:</b> so a duty alarm rings at the exact time.
      </>,
      <>
        <b>Full-screen alerts:</b> so the alarm shows over the lock screen.
      </>,
      <>
        <b>Do Not Disturb override</b> for the duty-alarm channel only, so an alarm can ring when the phone is on
        silent.
      </>,
    ],
  },
  {
    id: "who-sees-it",
    heading: "Who sees it",
    paragraphs: [
      <>
        Your exam cell can see your account and duties. Colleagues may see names on the duty schedules you share.
        Each college's data is kept separate from every other college's. We share data only with the providers that
        run Proctavo for us, and only for that purpose:
      </>,
    ],
    points: [
      <>Amazon Web Services: our servers.</>,
      <>MongoDB Atlas: our database.</>,
      <>Microsoft 365: sending email.</>,
      <>Expo and Google Firebase Cloud Messaging: delivering push notifications to phones.</>,
      <>Google Fonts: the website's fonts, which your browser loads from Google.</>,
    ],
  },
  {
    id: "retention",
    heading: "How long we keep it",
    paragraphs: [
      <>
        For as long as your college uses Proctavo and your account exists. When your exam cell removes your account it
        stops working at once, and it is permanently deleted on request (see below). Your college may keep records of
        past exam duties without your personal details. Signing out of the app removes your phone's push token from our
        servers. Server logs are kept only for a short period.
      </>,
    ],
  },
  {
    id: "delete-account",
    heading: "Deleting your account and data",
    paragraphs: [
      <>To have your Proctavo account and personal data deleted, do either of these:</>,
    ],
    points: [
      <>Ask your college's exam cell (CS) to remove your account, or</>,
      <>
        Email <Mail /> from the address on your account, with the subject "Delete my Proctavo account". We'll confirm
        with your college and delete your account and personal data within 30 days.
      </>,
    ],
  },
  {
    id: "security",
    heading: "Security",
    paragraphs: [
      <>
        All traffic is encrypted (HTTPS). Passwords are hashed, access depends on your role, and colleges are kept
        apart. No system is perfectly secure: if you find a problem, please tell us at <Mail />.
      </>,
    ],
  },
  {
    id: "children",
    heading: "Children",
    paragraphs: [<>Proctavo is for college staff. It isn't meant for children and we don't knowingly collect their data.</>],
  },
  {
    id: "your-rights",
    heading: "Your rights",
    paragraphs: [
      <>
        You can ask to see, correct or delete your personal data, and you can turn off notifications at any time in
        your phone's settings. Write to <Mail />. We aim to reply within 30 days.
      </>,
    ],
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    paragraphs: [
      <>
        If we change this policy we'll update the date at the top. For significant changes we'll also tell you in
        Proctavo or by email.
      </>,
    ],
  },
  {
    id: "contact",
    heading: "Contact",
    paragraphs: [
      <>
        {PRIVACY_PUBLISHER}: <Mail />
      </>,
    ],
  },
];
