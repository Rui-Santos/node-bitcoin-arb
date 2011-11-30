-- phpMyAdmin SQL Dump
-- version 3.3.7deb6
-- http://www.phpmyadmin.net
--
-- Host: 10.6.10.156
-- Generation Time: Nov 30, 2011 at 04:09 PM
-- Server version: 5.1.49
-- PHP Version: 5.3.3-7+squeeze3

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Database: `dev_arb`
--

-- --------------------------------------------------------

--
-- Table structure for table `Currencies`
--

CREATE TABLE IF NOT EXISTS `Currencies` (
  `Id` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `Symbol` char(3) NOT NULL,
  `Rate` decimal(8,5) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Dt` (`Symbol`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 AUTO_INCREMENT=16 ;

-- --------------------------------------------------------

--
-- Table structure for table `Exchanges`
--

CREATE TABLE IF NOT EXISTS `Exchanges` (
  `Id` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `Code` varchar(10) NOT NULL,
  `Fee` decimal(5,4) unsigned NOT NULL,
  `Dt` datetime NOT NULL,
  `BTC` decimal(16,8) unsigned NOT NULL,
  `USD` decimal(9,2) unsigned NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Code` (`Code`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 COMMENT='Exchanges' AUTO_INCREMENT=10 ;

-- --------------------------------------------------------

--
-- Table structure for table `Orders`
--

CREATE TABLE IF NOT EXISTS `Orders` (
  `Exchanges_Id` tinyint(3) unsigned NOT NULL,
  `Currencies_Id` tinyint(3) unsigned NOT NULL,
  `Dt` datetime NOT NULL,
  `BidAsk` enum('bid','ask') NOT NULL,
  `Price` decimal(16,7) unsigned NOT NULL,
  `Amount` int(10) unsigned NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `Rates`
--

CREATE TABLE IF NOT EXISTS `Rates` (
  `Exchanges_Id` tinyint(3) unsigned NOT NULL,
  `Currencies_Id` tinyint(4) unsigned NOT NULL,
  `Bid` decimal(8,5) unsigned NOT NULL,
  `Ask` decimal(8,5) unsigned NOT NULL,
  UNIQUE KEY `Exchanges_Id` (`Exchanges_Id`,`Currencies_Id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
