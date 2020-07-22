
import React from 'react';
import { connect } from 'react-redux';
import Head from 'next/head';
import NextSeo from 'next-seo';
import { BOTTOM_OFFSET, NUMBER_OF_POSTS, NUMBER_OF_PINS } from 'constants';
import _ from 'lodash';

import {
  bem,
  generateUrl,
  convertToName,
  fillSortAndFilter,
  fillQueryParams,
  getCenter,
  getParams,
} from 'utils';

import PropTypes from 'prop-types';
import DetailPage from 'pages/detail';

import {
  getPostsData,
  loadPostsData,
  getListingData,
  clearListingData,
  getPinsData,
} from 'store/actions';
import getListing from 'store/shape/listing/selectors';
import {
  pins, 
  pinsCount,
  coords,
  pinsLoaded,
} from 'store/shape/pins/selectors';
import { posts, postsLoaded, postsCount } from 'store/shape/posts/selectors';

import {
  Header, 
  GoogleMap,
  Footer, 
  CityList,
  LoadingScreen,
  Advertising,
  Filter,
  AgreementPopup,
} from 'components';
import ListFoundItems from './ListFoundItems/index';
import EmptyList from './EmptyList/index';
import './styles.styl';

const url = require('url');

const block = bem('result');


const propTypes = {
  city: PropTypes.string.isRequired,
  query: PropTypes.objectOf(PropTypes.string),
  referer: PropTypes.string.isRequired,
  asPath: PropTypes.string.isRequired,
  postsNumber: PropTypes.number.isRequired,
  coordsSearch: PropTypes.objectOf(PropTypes.number).isRequired,
  getListingItem: PropTypes.func.isRequired,
  clearListingItem: PropTypes.func.isRequired,
  getPins: PropTypes.func.isRequired,
  getPosts: PropTypes.func.isRequired,
  selectedListing: PropTypes.objectOf(PropTypes.any),
  pinsData: PropTypes.arrayOf(PropTypes.object),
  postsData: PropTypes.arrayOf(PropTypes.object),
  postsIsLoad: PropTypes.bool.isRequired,
  pinsIsLoad: PropTypes.bool.isRequired,
  loadPosts: PropTypes.func.isRequired,
  propertytype: PropTypes.string,
};

const defaultProps = {
  query: {},
  selectedListing: {},
  pinsData: [],
  postsData: [],
  propertytype: '',
};


class Result extends React.Component {
  static async getInitialProps({
    req, res, asPath, store,
  }) {
    const { dispatch, getState } = store;
    const { headers: { host } } = req;
    const { city } = req.params;
    const [cityName, propertytype] = city.split('-');
    const { query } = req;
    const params = {
      params: cityName.toLowerCase(),
      propertytype,
      ...query,
      offset: 0,
    };
    await dispatch(
      getPinsData({
        ...params,
        count: NUMBER_OF_PINS,
        pinsonly: true,
      }),
    );

    await dispatch(
      getPostsData({
        ...params,
        count: NUMBER_OF_POSTS,
      }),
    );

    const props = getState();

    const { data, count: postsNumber } = props.posts;
    if (postsNumber === 1) {
      const {addr_street_address: address, listing_hash: id, City} = data[0];
      res.redirect(generateUrl(City, address || 'no_address', id, true));
      res.end();
      return {};
    }

    return {
      city: cityName.toLowerCase(),
      propertytype,
      query,
      referer: `${host}${asPath}`,
      asPath,
      postsNumber,
    };
  }

  scrolling = _.throttle(() => {
    this.isListBottom();
  }, 300);

  constructor(props) {
    super(props);
    this.offset = 0;
    this.countPosts = NUMBER_OF_POSTS;
    this.countPins = NUMBER_OF_PINS;
    this.isMobil = false;
    this.top = React.createRef();
    this.list = React.createRef();
    this.timerId = null;

    this.state = {
      city: props.city,
      hoverHash: '',

      filterValue: [],
      sortValue: null,
      searchValue: '',

      isSearchMap: false,
      isBusy: false,
      footerBottom: false,
      bigMap: false,
      showAgreement: false,
    };
  }

  componentDidMount() {
    const {dataItems} = this.state;
    if (dataItems && dataItems.length === 1) {
      this.gouToDetails(dataItems[0]);
    }
    document.addEventListener('scroll', this.scrolling);
    window.addEventListener('resize', this.changeIndentList);
    this.fillSortFilter();

    this.html = document.querySelector('html');
    this.isMobil = !this.html.offsetWidth <= 1024;
    this.bodyStyle = document.body.style;
    this.changeIndentList();
    this.footerPosition();
  }

  componentWillReceiveProps(nextProps) {
    const { selectedListing, postsIsLoad } = nextProps;

    if (selectedListing && selectedListing.listing_hash) {
      this.viewPopup(selectedListing);
    }

    if (!postsIsLoad) {
      this.setState({isBusy: false});
    }
  }

  componentWillUpdate(nextProps) {
    const {selectedListing} = nextProps;
    this.bodyStyle.overflow = (selectedListing && selectedListing.listing_hash) ? 'hidden' : 'auto';
  }

  componentDidUpdate() {
    const {postsData} = this.props;
    if (postsData && postsData.length === 1) {
      this.goToDetails(postsData[0]);
    }
    this.footerPosition();
  }

  componentWillUnmount() {
    document.removeEventListener('scroll', this.scrolling);
    window.removeEventListener('resize', this.changeIndentList);
  }

  goToDetails = (item) => {
    const {addr_street_address: address, listing_hash: id, City} = item;
    document.location.href = generateUrl(City, address || 'no_address', id, true);
  }

  fillSortFilter = () => {
    const {query, propertytype} = this.props;
    const data = fillSortAndFilter({...query, propertytype});
    this.setState({
      filterValue: data.filterValue,
      sortValue: data.sortValue,
    });
  };

  setStateField = field => (value) => {
    const { filterValue, city } = this.state;
    this.setState({[field]: value});
    this.createURL(value, filterValue, city);
  };

  changeIndentList = () => {
    if (this.top.current.offsetWidth >= 1024 && this.isMobil) {
      this.isMobil = false;
      this.setState({
        offsetTop: `${this.top.current.offsetHeight}px`,
      });
    }

    if (this.top.current.offsetWidth <= 1024 && !this.isMobil) {
      this.isMobil = true;
      this.setState({
        offsetTop: '0',
      });
    }
  };

  footerPosition = () => {
    const {footerBottom} = this.state;
    if (this.list.current !== null && this.top.current !== null) {
      const newPlase = this.html.offsetHeight
        - this.top.current.offsetHeight - this.list.current.offsetHeight >= 0;
      if (footerBottom !== newPlase) {
        this.setState({footerBottom: newPlase});
      }
    }
  };

  renderPopup = () => {
    const {selectedListing} = this.props;
    if (selectedListing && selectedListing.listing_hash) {
      return (
        <div className={block('popup')}>
          <DetailPage data={selectedListing} onClose={this.closePopup} className={block('popupItem')} />
        </div>
      );
    }
    return null;
  };

  updateItems = async (newCity, query, isNewData, propertytype) => {
    const {
      loadPosts, coordsSearch, getPosts, getPins,
    } = this.props;
    const {
      isSearchMap, city,
    } = this.state;

    this.offset += this.countPosts;

    if (isNewData) {
      this.offset = 0;
    }

    const params = getParams({
      city: newCity,
      isNewData,
      coordsSearch,
      isSearchMap,
      offset: this.offset,
    });

    if (isNewData) {
      getPosts({...params, ...query, propertytype});
    } else {
      loadPosts({...params, ...query, propertytype});
    }
    if (newCity !== city) {
      getPins({...params, count: this.countPins, pinsonly: true });
    }
  };

  hoverItem = (listingHash, value) => {
    if (value) {
      this.setState({ hoverHash: listingHash });
      return;
    }
    this.setState({ hoverHash: '' });
  };

  isListBottom = () => {
    const {postsIsLoad, postsData, postsNumber} = this.props;
    const {sortValue, filterValue, city} = this.state;
    const bodyHeight = document.body.offsetHeight;
    const scrollHeight = this.html.scrollTop;
    const bodyScrollHeight = this.html.scrollHeight;
    const distanceToBottom = bodyScrollHeight * BOTTOM_OFFSET <= bodyHeight + scrollHeight;

    if (!postsIsLoad && distanceToBottom && postsData.length < postsNumber) {
      const queryParams = fillQueryParams(sortValue, filterValue);
      this.updateItems(city, queryParams);
    }
  };

  getPopupData = (value) => {
    const { getListingItem } = this.props;
    const isAcceptAgreement = JSON.parse(localStorage.getItem('accept-agreement'));
    if (!isAcceptAgreement) {
      this.setState({showAgreement: !isAcceptAgreement});
    } else {
      getListingItem(value);
    }
  };

  viewPopup = (selectedListing) => {
    const {city} = this.props;
    const selectedItem = selectedListing;
    const {addr_street_address: address, listing_hash: id} = selectedItem;
    if (address && id) {
      window.history.replaceState(null, 'popup', generateUrl(city, address || 'no_address', id, true));
    }
  };

  closePopup = () => {
    const {asPath, clearListingItem} = this.props;
    window.history.replaceState(null, 'list', asPath);
    clearListingItem();
  };

  listItems = () => {
    const { bigMap, isBusy, hoverHash } = this.state;
    const { postsData } = this.props;
    if (isBusy) {
      return false;
    }
    if (postsData && postsData.length) {
      return (
        <React.Fragment>
          <ListFoundItems
            dataItems={postsData}
            hoverItem={this.hoverItem}
            hoverHash={hoverHash}
            openPopup={this.getPopupData}
            bigMap={bigMap}
          />
        </React.Fragment>
      );
    }
    return false;
  };

  createURL = (sortValue, filterValue, city) => {
    const {city: oldCity} = this.state;
    const { propertytype, ...queryParams } = fillQueryParams(sortValue, filterValue);
    const pathname = `${city}${propertytype ? `-${propertytype}-for-sale` : ''}`;
    window.history.replaceState(null, 'Filter',
      url.format({
        pathname,
        query: queryParams,
      }));
    if (oldCity === city) this.updateItems(city, queryParams, true, propertytype);
  };

  onSubmit = (event) => {
    if (event) {
      event.preventDefault();
    }
    const {sortValue, filterValue, searchValue} = this.state;
    if (searchValue.trim().length) {
      this.setState({city: searchValue, isBusy: true});
      this.createURL(sortValue, filterValue, searchValue);
      this.setState({isSearchMap: false}, this.getDataCity(searchValue));
    }
  };

  onInputChange = (e) => {
    const {value} = e.target;
    this.setState({
      searchValue: value,
    });
  };

  onClickPredict = (name) => {
    const {sortValue, filterValue, value} = this.state;
    this.setState({
      searchValue: name,
      city: name,
    });
    if (value !== name) {
      this.createURL(sortValue, filterValue, name);
    }
    this.getDataCity(name);
    this.setState({
      isSearchMap: false,
    });
  }

  onFilterChange = (value) => {
    const {sortValue, city} = this.state;
    const newData = value.filter((item, i) => !(item.type === value[value.length - 1].type
      && i !== value.length - 1));

    this.setState({filterValue: newData});
    this.createURL(sortValue, newData, city);
  };

  getDataCoords = (data) => {
    const [
      minlat,
      maxlat,
      minlon,
      maxlon,
    ] = Object.values(data)
      .reduce((acc, item) => [...acc, ...Object.values(item)], []);
    const { getPins, getPosts } = this.props;
    const params = {
      minlon,
      maxlon,
      minlat,
      maxlat,
      offset: 0,
    };

    getPins({
      ...params,
      count: this.countPins,
      pinsonly: true,
    });

    getPosts({
      ...params,
      count: this.countPosts,
    });
  }

  toggleMap = (coordsMap) => {
    const { isSearchMap, city } = this.state;
    if (!isSearchMap) {
      this.getDataCoords(coordsMap);
    } else {
      this.getDataCity(city);
    }
    this.setState({isSearchMap: !isSearchMap});
    this.offset = 0;
  }

  resizeMap = () => {
    const {bigMap} = this.state;
    this.setState({bigMap: !bigMap});
  }

  getDataCity = (city) => {
    const { getPosts, getPins } = this.props;
    const { sortValue, filterValue } = this.state;
    const queryParams = fillQueryParams(sortValue, filterValue);
    const params = {
      params: city,
      offset: 0,
    };
    getPins({...params, count: this.countPins, pinsonly: true });
    getPosts({...params, count: this.countPosts, ...queryParams });
  }

  closePopupAgreement = () => {
    this.setState({showAgreement: false});
  }

  render() {
    const {
      offsetTop,
      filterValue,
      sortValue,
      searchValue,
      isBusy,
      hoverHash,
      footerBottom,
      isSearchMap,
      bigMap,
      city,
      showAgreement,
    } = this.state;

    const {
      referer,
      pinsData,
      pinsIsLoad,
      postsData,
      postsNumber,
      coordsSearch,
    } = this.props;

    const center = getCenter(coordsSearch);
    const cityForSeo = convertToName(city);
    const propertytype = filterValue.find(({type}) => type === 'propertytype');
    const typeForSeo = propertytype ? convertToName(propertytype.value) : '';
    const showAds = !!(!bigMap && postsData && postsData.length);
    return (
      <React.Fragment>
        <NextSeo
          config={{
            title: `${postsNumber} ${cityForSeo} ${typeForSeo} For Sale | Zooky.ca Real Estate Search Portal`,
            description: `There are ${postsNumber} ${cityForSeo} ${typeForSeo} For Sale on the Zooky.ca real estate search portal. Zooky is the #1 real estate search portal in Canada.
            `,
            openGraph: {
              url: referer,
              title: `${postsNumber} ${cityForSeo} ${typeForSeo} For Sale | Zooky.ca Real Estate Search Portal`,
              images: [
                {
                  url: 'https://zooky.ca/wp-content/uploads/2017/12/zooky_logo_white-transparent-1000x236-e1513097000164.png',
                  width: 254,
                  height: 60,
                  alt: 'Canada Real Estate Marketplace',
                },
              ],
              description: `Find the most up date ${cityForSeo} real estate for sale, ${cityForSeo} homes for sale, ${cityForSeo} condos for sale and all other real estate for sale in ${cityForSeo}.`,
            },
          }}
        />
        <Head>
          <meta property="og:image:secure_url" content="https://zooky.ca/wp-content/uploads/2017/12/zooky_logo_white-transparent-1000x236-e1513097000164.png" />
        </Head>
        <div className={(postsData && postsData.length) ? block('top') : `${block('top')} ${block('withOutMap')}`} ref={this.top}>
          <Header withLinks className={block('resultHeader')} />
          <Filter
            disabled={isBusy}
            city={city}
            typeForSeo={typeForSeo}
            resultCount={postsNumber}
            filterValue={filterValue}
            sortValue={sortValue}
            value={searchValue}
            onFilterChange={this.onFilterChange}
            onInputChange={this.onInputChange}
            onSubmit={this.onSubmit}
            setStateField={this.setStateField}
            onClickPredict={this.onClickPredict}
          />
        </div>
        {!!(postsData && postsData.length) && (
          <div
            ref={this.list}
            className={!postsData.length ? `${block('resultBlock')} ${block('withOutMap')}` : block('resultBlock')}
            style={{paddingTop: offsetTop, paddingLeft: bigMap && '75%'}}
          >
            {this.listItems()}
            {isBusy && <LoadingScreen />}
          </div>
        )}
        {(postsData && postsData.length) && (
          <div className={block('leftBlock')} style={{height: `calc(100vh - (${offsetTop} + 68px)`, marginTop: offsetTop, width: bigMap && '75%'}}>
            <GoogleMap
              hoverItem={this.hoverItem}
              hoverHash={hoverHash}
              openPopup={this.getPopupData}
              items={pinsData}
              className={pins.length ? `${block('resultMap')} ${bigMap && block('bigMap')}` : `${block('resultMap')} ${block('withOutMap')}`}
              center={center}
              collapsible
              bigMap={bigMap}
              resizeMap={this.resizeMap}
              onSearchMap={this.getDataCoords}
              toggleMap={this.toggleMap}
              geoData={coordsSearch}
              isSearchMap={isSearchMap}
              pinsIsLoad={pinsIsLoad}
            />
            {showAds && <Advertising />}
          </div>
        )
        }
        {(!postsData || !postsData.length) && <EmptyList city={city} />}
        {(!postsData || !postsData.length) && <CityList className={block('cityList')} />}
        <Footer className={(footerBottom && isBusy) ? block('footerBottom') : block('resultFooter')} />
        {showAgreement && <AgreementPopup close={this.closePopupAgreement} className={block('agreement')} />}
        {this.renderPopup()}
      </React.Fragment>
    );
  }
}

Result.propTypes = propTypes;
Result.defaultProps = defaultProps;

const stateProps = state => ({
  selectedListing: getListing(state),
  pinsData: pins(state),
  pinsIsLoad: pinsLoaded(state),
  postsIsLoad: postsLoaded(state),
  postsData: posts(state),
  postsNumber: postsCount(state),
  pinsNumber: pinsCount(state),
  coordsSearch: coords(state),
});

const dispathProps = dispatch => ({
  getListingItem: id => (
    dispatch(
      getListingData(id),
    )
  ),
  clearListingItem: () => dispatch(clearListingData()),
  getPins: params => (
    dispatch(
      getPinsData(params),
    )
  ),
  getPosts: params => (
    dispatch(
      getPostsData(params),
    )
  ),
  loadPosts: params => (
    dispatch(
      loadPostsData(params),
    )
  ),
});

export default connect(stateProps, dispathProps)(Result);
